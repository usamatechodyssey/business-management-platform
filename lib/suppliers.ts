// lib/suppliers.ts
//
// Server-only supplier, purchase, and payment logic. Shared by the
// suppliers page (Server Component initial load) and the suppliers API
// routes (client-side queries/mutations).
//
// Purchase creation, purchase deletion, and payment recording all touch
// three collections (purchases, products, suppliers — plus supplierPayments
// for payments). They run inside MongoDB multi-document transactions so a
// partial application can never leave stock or owed totals inconsistent.
// The withTransaction + ValidationError helpers now live in
// lib/mongo-transaction.ts so lib/sales.ts can reuse them.

import { getDb } from "@/lib/db";
import { withTransaction, ValidationError } from "@/lib/mongo-transaction";
import type {
  Product,
  Purchase,
  PurchaseItem,
  Supplier,
  SupplierPayment,
} from "@/types";

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Suppliers: read ─────────────────────────────────────────────

export async function listSuppliers(
  businessId: string,
  query?: string
): Promise<Supplier[]> {
  const db = await getDb();
  const filter: Record<string, unknown> = { businessId };

  if (query && query.trim()) {
    const escaped = escapeRegex(query.trim());
    filter.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { phone: { $regex: escaped, $options: "i" } },
      { contactPerson: { $regex: escaped, $options: "i" } },
    ];
  }

  return db
    .collection<Supplier>("suppliers")
    .find(filter)
    .sort({ name: 1 })
    .toArray();
}

export async function getSupplierById(
  businessId: string,
  supplierId: string
): Promise<Supplier | null> {
  const db = await getDb();
  return db
    .collection<Supplier>("suppliers")
    .findOne({ id: supplierId, businessId });
}

export async function isSupplierPhoneTaken(
  businessId: string,
  phone: string,
  excludeId?: string
): Promise<boolean> {
  const db = await getDb();
  const filter: Record<string, unknown> = { businessId, phone };
  if (excludeId) filter.id = { $ne: excludeId };
  const existing = await db
    .collection<Supplier>("suppliers")
    .findOne(filter, { projection: { id: 1 } });
  return existing !== null;
}

// ── Suppliers: write ────────────────────────────────────────────

export async function insertSupplier(supplier: Supplier): Promise<void> {
  const db = await getDb();
  await db.collection<Supplier>("suppliers").insertOne(supplier);
}

export async function updateSupplierFields(
  businessId: string,
  supplierId: string,
  updates: Partial<
    Omit<Supplier, "id" | "businessId" | "totalOwed" | "createdAt">
  >
): Promise<Supplier | null> {
  const db = await getDb();
  return db.collection<Supplier>("suppliers").findOneAndUpdate(
    { id: supplierId, businessId },
    { $set: updates },
    { returnDocument: "after" }
  );
}

export async function supplierHasPurchases(
  businessId: string,
  supplierId: string
): Promise<boolean> {
  const db = await getDb();
  const existing = await db
    .collection<Purchase>("purchases")
    .findOne({ businessId, supplierId }, { projection: { id: 1 } });
  return existing !== null;
}

export async function deleteSupplier(
  businessId: string,
  supplierId: string
): Promise<boolean> {
  const db = await getDb();
  const result = await db
    .collection<Supplier>("suppliers")
    .deleteOne({ id: supplierId, businessId });
  return result.deletedCount === 1;
}

// ── Purchases: read ─────────────────────────────────────────────

export async function listPurchasesForSupplier(
  businessId: string,
  supplierId: string
): Promise<Purchase[]> {
  const db = await getDb();
  return db
    .collection<Purchase>("purchases")
    .find({ businessId, supplierId })
    .sort({ date: -1, createdAt: -1 })
    .toArray();
}

export async function getPurchaseById(
  businessId: string,
  purchaseId: string
): Promise<Purchase | null> {
  const db = await getDb();
  return db
    .collection<Purchase>("purchases")
    .findOne({ id: purchaseId, businessId });
}

// ── Purchases: create (transactional) ───────────────────────────

export interface CreatePurchaseInput {
  businessId: string;
  supplierId: string;
  items: Array<{ productId: string; qty: number; cost: number }>;
  date: string;
  invoiceNo?: string;
  initialPayment: number;
}

export type CreatePurchaseErrorCode =
  | "SUPPLIER_NOT_FOUND"
  | "PRODUCT_NOT_FOUND"
  | "INVALID_PAYMENT";

export type CreatePurchaseResult =
  | { success: true; purchase: Purchase }
  | { success: false; code: CreatePurchaseErrorCode };

export async function createPurchase(
  input: CreatePurchaseInput
): Promise<CreatePurchaseResult> {
  const { businessId, supplierId, items, date, invoiceNo, initialPayment } =
    input;

  try {
    const purchase = await withTransaction(async (session) => {
      const db = await getDb();
      const suppliers = db.collection<Supplier>("suppliers");
      const products = db.collection<Product>("products");
      const purchases = db.collection<Purchase>("purchases");
      const payments = db.collection<SupplierPayment>("supplierPayments");

      // 1. Supplier exists?
      const supplier = await suppliers.findOne(
        { id: supplierId, businessId },
        { session }
      );
      if (!supplier) throw new ValidationError("SUPPLIER_NOT_FOUND");

      // 2. All products exist and belong to this business?
      const uniqueIds = Array.from(new Set(items.map((i) => i.productId)));
      const productDocs = await products
        .find({ businessId, id: { $in: uniqueIds } }, { session })
        .toArray();
      if (productDocs.length !== uniqueIds.length) {
        throw new ValidationError("PRODUCT_NOT_FOUND");
      }
      const productById = new Map(productDocs.map((p) => [p.id, p]));

      // 3. Build PurchaseItem[] with server-resolved names (client can't
      //    fake product names) and compute totalCost.
      const purchaseItems: PurchaseItem[] = items.map((item) => {
        const product = productById.get(item.productId);
        if (!product) throw new ValidationError("PRODUCT_NOT_FOUND");
        return {
          productId: item.productId,
          productName: product.name,
          qty: item.qty,
          cost: item.cost,
        };
      });

      const totalCost = purchaseItems.reduce(
        (sum, item) => sum + item.qty * item.cost,
        0
      );

      if (initialPayment < 0 || initialPayment > totalCost) {
        throw new ValidationError("INVALID_PAYMENT");
      }

      const now = new Date().toISOString();
      const purchase: Purchase = {
        id: crypto.randomUUID(),
        businessId,
        supplierId,
        supplierName: supplier.name,
        items: purchaseItems,
        date,
        totalCost,
        amountPaid: initialPayment,
        paid: initialPayment >= totalCost,
        createdAt: now,
      };
      if (invoiceNo) purchase.invoiceNo = invoiceNo;

      // 4. Apply stock + cost price changes (latest cost wins).
      for (const item of purchaseItems) {
        await products.updateOne(
          { id: item.productId, businessId },
          { $inc: { stockQty: item.qty }, $set: { costPrice: item.cost } },
          { session }
        );
      }

      // 5. Bump supplier owed by the unpaid remainder.
      const owedDelta = totalCost - initialPayment;
      if (owedDelta !== 0) {
        await suppliers.updateOne(
          { id: supplierId, businessId },
          { $inc: { totalOwed: owedDelta } },
          { session }
        );
      }

      // 6. Log the initial payment (if any) so every rupee has a record.
      if (initialPayment > 0) {
        const payment: SupplierPayment = {
          id: crypto.randomUUID(),
          businessId,
          supplierId,
          purchaseId: purchase.id,
          amount: initialPayment,
          date,
          createdAt: now,
        };
        await payments.insertOne(payment, { session });
      }

      // 7. Finally insert the purchase itself.
      await purchases.insertOne(purchase, { session });

      return purchase;
    });

    return { success: true, purchase };
  } catch (err) {
    if (err instanceof ValidationError) {
      return { success: false, code: err.code as CreatePurchaseErrorCode };
    }
    throw err;
  }
}

// ── Purchases: delete (transactional) ───────────────────────────
//
// Allowed only when no payments have been recorded against this purchase,
// because reversing a paid purchase would require knowing which rupees to
// un-pay. Reverse stock and supplier owed; cost price is intentionally
// NOT restored — after any purchase, costPrice reflects the latest
// purchase price, and un-doing that safely requires an append-only cost
// history we don't keep in v1.

export type DeletePurchaseErrorCode = "NOT_FOUND" | "HAS_PAYMENTS";

export type DeletePurchaseResult =
  | { success: true }
  | { success: false; code: DeletePurchaseErrorCode };

export async function deletePurchase(
  businessId: string,
  purchaseId: string
): Promise<DeletePurchaseResult> {
  try {
    await withTransaction(async (session) => {
      const db = await getDb();
      const purchases = db.collection<Purchase>("purchases");
      const products = db.collection<Product>("products");
      const suppliers = db.collection<Supplier>("suppliers");

      const purchase = await purchases.findOne(
        { id: purchaseId, businessId },
        { session }
      );
      if (!purchase) throw new ValidationError("NOT_FOUND");
      if (purchase.amountPaid > 0) throw new ValidationError("HAS_PAYMENTS");

      for (const item of purchase.items) {
        await products.updateOne(
          { id: item.productId, businessId },
          { $inc: { stockQty: -item.qty } },
          { session }
        );
      }

      const owedDelta = purchase.totalCost - purchase.amountPaid;
      if (owedDelta !== 0) {
        await suppliers.updateOne(
          { id: purchase.supplierId, businessId },
          { $inc: { totalOwed: -owedDelta } },
          { session }
        );
      }

      await purchases.deleteOne({ id: purchaseId, businessId }, { session });
    });

    return { success: true };
  } catch (err) {
    if (err instanceof ValidationError) {
      return { success: false, code: err.code as DeletePurchaseErrorCode };
    }
    throw err;
  }
}

// ── Payments: record (transactional) ────────────────────────────
//
// Payments are always attached to a specific purchase, which gives the
// owner a per-invoice audit trail and prevents FIFO-allocation ambiguity
// when one supplier has multiple outstanding purchases.

export interface RecordPaymentInput {
  businessId: string;
  supplierId: string;
  purchaseId: string;
  amount: number;
  date: string;
  note?: string;
}

export type RecordPaymentErrorCode =
  | "PURCHASE_NOT_FOUND"
  | "INVALID_AMOUNT";

export type RecordPaymentResult =
  | { success: true; payment: SupplierPayment; purchase: Purchase }
  | { success: false; code: RecordPaymentErrorCode };

export async function recordPurchasePayment(
  input: RecordPaymentInput
): Promise<RecordPaymentResult> {
  const { businessId, supplierId, purchaseId, amount, date, note } = input;

  try {
    const result = await withTransaction(async (session) => {
      const db = await getDb();
      const purchases = db.collection<Purchase>("purchases");
      const suppliers = db.collection<Supplier>("suppliers");
      const payments = db.collection<SupplierPayment>("supplierPayments");

      const purchase = await purchases.findOne(
        { id: purchaseId, businessId, supplierId },
        { session }
      );
      if (!purchase) throw new ValidationError("PURCHASE_NOT_FOUND");

      const outstanding = purchase.totalCost - purchase.amountPaid;
      if (amount <= 0 || amount > outstanding) {
        throw new ValidationError("INVALID_AMOUNT");
      }

      const now = new Date().toISOString();
      const payment: SupplierPayment = {
        id: crypto.randomUUID(),
        businessId,
        supplierId,
        purchaseId,
        amount,
        date,
        createdAt: now,
      };
      if (note) payment.note = note;

      const newAmountPaid = purchase.amountPaid + amount;
      const updatedPurchase = await purchases.findOneAndUpdate(
        { id: purchaseId },
        {
          $set: {
            amountPaid: newAmountPaid,
            paid: newAmountPaid >= purchase.totalCost,
          },
        },
        { returnDocument: "after", session }
      );
      if (!updatedPurchase) throw new ValidationError("PURCHASE_NOT_FOUND");

      await suppliers.updateOne(
        { id: supplierId, businessId },
        { $inc: { totalOwed: -amount } },
        { session }
      );

      await payments.insertOne(payment, { session });

      return { payment, purchase: updatedPurchase };
    });

    return { success: true, ...result };
  } catch (err) {
    if (err instanceof ValidationError) {
      return { success: false, code: err.code as RecordPaymentErrorCode };
    }
    throw err;
  }
}