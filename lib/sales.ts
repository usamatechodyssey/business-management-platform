// lib/sales.ts
//
// Server-only sales logic. Sale creation runs in a MongoDB transaction
// because it touches three collections at once (products, sales, and —
// for khata/partial — customers + ledgerEntries). Profit Fund
// allocations are snapshotted inside the same transaction so a sale and
// its fund contributions are always consistent.

import { getDb } from "@/lib/db";
import { withTransaction, ValidationError } from "@/lib/mongo-transaction";
import { snapshotTierAllocations } from "@/lib/profit-fund";
import type {
  Business,
  Customer,
  LedgerEntry,
  PaymentMethod,
  Product,
  Sale,
  SaleItem,
} from "@/types";

export const SALES_PAGE_SIZE = 25;

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Read ────────────────────────────────────────────────────────

export interface ListSalesInput {
  businessId: string;
  from?: string;
  to?: string;
  customerId?: string;
  query?: string;
  page?: number;
}

export interface ListSalesResult {
  sales: Sale[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export async function listSales(
  input: ListSalesInput
): Promise<ListSalesResult> {
  const db = await getDb();
  const filter: Record<string, unknown> = { businessId: input.businessId };

  if (input.from || input.to) {
    const range: Record<string, string> = {};
    if (input.from) range.$gte = input.from;
    if (input.to) range.$lte = input.to;
    filter.date = range;
  }

  if (input.customerId) filter.customerId = input.customerId;

  if (input.query && input.query.trim()) {
    const escaped = escapeRegex(input.query.trim());
    filter.$or = [
      { customerName: { $regex: escaped, $options: "i" } },
      { id: { $regex: escaped, $options: "i" } },
    ];
  }

  const page = Math.max(1, Math.floor(input.page ?? 1));
  const skip = (page - 1) * SALES_PAGE_SIZE;
  const collection = db.collection<Sale>("sales");

  const [sales, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(SALES_PAGE_SIZE)
      .toArray(),
    collection.countDocuments(filter),
  ]);

  return {
    sales,
    page,
    pageSize: SALES_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / SALES_PAGE_SIZE)),
  };
}

export async function getSaleById(
  businessId: string,
  saleId: string
): Promise<Sale | null> {
  const db = await getDb();
  return db.collection<Sale>("sales").findOne({ id: saleId, businessId });
}

// ── Create (transactional) ──────────────────────────────────────

export interface CreateSaleInput {
  businessId: string;
  items: Array<{ productId: string; qty: number; price: number }>;
  customerId?: string;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  date: string;
}

export type CreateSaleErrorCode =
  | "EMPTY_CART"
  | "PRODUCT_NOT_FOUND"
  | "INSUFFICIENT_STOCK"
  | "CUSTOMER_REQUIRED"
  | "CUSTOMER_NOT_FOUND"
  | "CREDIT_LIMIT_EXCEEDED"
  | "INVALID_PAYMENT";

export type CreateSaleResult =
  | { success: true; sale: Sale; warning?: "CREDIT_LIMIT_EXCEEDED" }
  | {
      success: false;
      code: CreateSaleErrorCode;
      details?: Record<string, unknown>;
    };

export async function createSale(
  input: CreateSaleInput
): Promise<CreateSaleResult> {
  const { businessId, items, customerId, paymentMethod, amountPaid, date } =
    input;

  if (items.length === 0) {
    return { success: false, code: "EMPTY_CART" };
  }

  const needsCustomer =
    paymentMethod === "khata" || paymentMethod === "partial";
  if (needsCustomer && !customerId) {
    return { success: false, code: "CUSTOMER_REQUIRED" };
  }

  try {
    let warning: "CREDIT_LIMIT_EXCEEDED" | undefined;

    const sale = await withTransaction(async (session) => {
      const db = await getDb();
      const products = db.collection<Product>("products");
      const customers = db.collection<Customer>("customers");
      const sales = db.collection<Sale>("sales");
      const ledger = db.collection<LedgerEntry>("ledgerEntries");
      const businesses = db.collection<Business>("businesses");

      const uniqueIds = Array.from(new Set(items.map((i) => i.productId)));
      const productDocs = await products
        .find({ businessId, id: { $in: uniqueIds } }, { session })
        .toArray();
      if (productDocs.length !== uniqueIds.length) {
        throw new ValidationError("PRODUCT_NOT_FOUND");
      }
      const productById = new Map(productDocs.map((p) => [p.id, p]));

      for (const item of items) {
        const product = productById.get(item.productId);
        if (!product) throw new ValidationError("PRODUCT_NOT_FOUND");
        if (product.stockQty < item.qty) {
          throw new ValidationError("INSUFFICIENT_STOCK", {
            productId: product.id,
            productName: product.name,
            available: product.stockQty,
            requested: item.qty,
          });
        }
      }

      let customer: Customer | null = null;
      if (customerId) {
        customer = await customers.findOne(
          { id: customerId, businessId },
          { session }
        );
        if (!customer) throw new ValidationError("CUSTOMER_NOT_FOUND");
      }

      const saleItems: SaleItem[] = items.map((item) => {
        const product = productById.get(item.productId);
        if (!product) throw new ValidationError("PRODUCT_NOT_FOUND");
        return {
          productId: item.productId,
          productName: product.name,
          qty: item.qty,
          price: item.price,
          cost: product.costPrice,
        };
      });

      const total = saleItems.reduce((sum, i) => sum + i.qty * i.price, 0);
      const profit = saleItems.reduce(
        (sum, i) => sum + i.qty * (i.price - i.cost),
        0
      );

      let finalAmountPaid: number;
      let amountDue: number;

      if (paymentMethod === "cash" || paymentMethod === "online") {
        finalAmountPaid = total;
        amountDue = 0;
      } else if (paymentMethod === "khata") {
        finalAmountPaid = 0;
        amountDue = total;
      } else {
        if (amountPaid <= 0 || amountPaid >= total) {
          throw new ValidationError("INVALID_PAYMENT");
        }
        finalAmountPaid = amountPaid;
        amountDue = total - amountPaid;
      }

      if (customer && amountDue > 0) {
        const business = await businesses.findOne(
          { id: businessId },
          { session }
        );
        const khataSettings = business?.settings.khataSettings;
        if (khataSettings?.creditLimitEnabled) {
          const limit =
            customer.creditLimit ?? khataSettings.defaultCreditLimit;
          if (limit > 0) {
            const newDue = customer.totalDue + amountDue;
            if (newDue > limit) {
              if (khataSettings.blockSaleOnLimitExceeded) {
                throw new ValidationError("CREDIT_LIMIT_EXCEEDED", {
                  limit,
                  currentDue: customer.totalDue,
                  newDue,
                });
              }
              warning = "CREDIT_LIMIT_EXCEEDED";
            }
          }
        }
      }

      const now = new Date().toISOString();
      const sale: Sale = {
        id: crypto.randomUUID(),
        businessId,
        items: saleItems,
        date,
        total,
        amountPaid: finalAmountPaid,
        amountDue,
        profit,
        paymentMethod,
        createdAt: now,
      };
      if (customer) {
        sale.customerId = customer.id;
        sale.customerName = customer.name;
      }

      // Snapshot the enabled Profit Fund tiers against this sale's
      // profit. Frozen for the life of the sale — later rate changes
      // and tier disable operations never touch it.
      const profitFundAllocations = await snapshotTierAllocations(
        session,
        businessId,
        profit
      );
      if (profitFundAllocations.length > 0) {
        sale.profitFundAllocations = profitFundAllocations;
      }

      for (const item of saleItems) {
        await products.updateOne(
          { id: item.productId, businessId },
          { $inc: { stockQty: -item.qty } },
          { session }
        );
      }

      if (customer && amountDue > 0) {
        const newBalance = customer.totalDue + amountDue;

        const entry: LedgerEntry = {
          id: crypto.randomUUID(),
          businessId,
          customerId: customer.id,
          type: "sale",
          amount: amountDue,
          date,
          balanceAfter: newBalance,
          createdAt: now,
        };

        await customers.updateOne(
          { id: customer.id, businessId },
          { $set: { totalDue: newBalance } },
          { session }
        );
        await ledger.insertOne(entry, { session });
      }

      await sales.insertOne(sale, { session });

      return sale;
    });

    return warning ? { success: true, sale, warning } : { success: true, sale };
  } catch (err) {
    if (err instanceof ValidationError) {
      return {
        success: false,
        code: err.code as CreateSaleErrorCode,
        details: err.details,
      };
    }
    throw err;
  }
}

// ── Delete / reversal (transactional) ───────────────────────────

export type DeleteSaleErrorCode = "NOT_FOUND" | "HAS_KHATA_BALANCE";

export type DeleteSaleResult =
  | { success: true }
  | { success: false; code: DeleteSaleErrorCode };

export async function deleteSale(
  businessId: string,
  saleId: string
): Promise<DeleteSaleResult> {
  try {
    await withTransaction(async (session) => {
      const db = await getDb();
      const sales = db.collection<Sale>("sales");
      const products = db.collection<Product>("products");

      const sale = await sales.findOne(
        { id: saleId, businessId },
        { session }
      );
      if (!sale) throw new ValidationError("NOT_FOUND");

      if (sale.paymentMethod === "khata" || sale.paymentMethod === "partial") {
        throw new ValidationError("HAS_KHATA_BALANCE");
      }

      for (const item of sale.items) {
        await products.updateOne(
          { id: item.productId, businessId },
          { $inc: { stockQty: item.qty } },
          { session }
        );
      }

      await sales.deleteOne({ id: saleId, businessId }, { session });
    });

    return { success: true };
  } catch (err) {
    if (err instanceof ValidationError) {
      return { success: false, code: err.code as DeleteSaleErrorCode };
    }
    throw err;
  }
}