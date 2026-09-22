// lib/customers.ts
//
// Server-only customer + khata ledger logic. Shared by the customers
// page (Server Component initial load) and the customers API routes.
//
// Payment recording runs in a MongoDB transaction: Customer.totalDue
// (denormalized balance) and the LedgerEntry row are always applied
// atomically, so they can never drift. The ledger is append-only —
// mistakes are corrected by recording an offsetting entry, not by
// deleting, matching how physical khata books work.
//
// The withTransaction + ValidationError helpers now live in
// lib/mongo-transaction.ts so lib/sales.ts can reuse them.

import { getDb } from "@/lib/db";
import { withTransaction, ValidationError } from "@/lib/mongo-transaction";
import type { Customer, LedgerEntry } from "@/types";

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Customers: read ─────────────────────────────────────────────

export async function listCustomers(
  businessId: string,
  query?: string
): Promise<Customer[]> {
  const db = await getDb();
  const filter: Record<string, unknown> = { businessId };

  if (query && query.trim()) {
    const escaped = escapeRegex(query.trim());
    filter.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { phone: { $regex: escaped, $options: "i" } },
      { tag: { $regex: escaped, $options: "i" } },
    ];
  }

  return db
    .collection<Customer>("customers")
    .find(filter)
    .sort({ name: 1 })
    .toArray();
}

export async function getCustomerById(
  businessId: string,
  customerId: string
): Promise<Customer | null> {
  const db = await getDb();
  return db
    .collection<Customer>("customers")
    .findOne({ id: customerId, businessId });
}

export async function isCustomerPhoneTaken(
  businessId: string,
  phone: string,
  excludeId?: string
): Promise<boolean> {
  const db = await getDb();
  const filter: Record<string, unknown> = { businessId, phone };
  if (excludeId) filter.id = { $ne: excludeId };
  const existing = await db
    .collection<Customer>("customers")
    .findOne(filter, { projection: { id: 1 } });
  return existing !== null;
}

// ── Customers: write ────────────────────────────────────────────

export async function insertCustomer(customer: Customer): Promise<void> {
  const db = await getDb();
  await db.collection<Customer>("customers").insertOne(customer);
}

// `totalDue` and `createdAt` are intentionally not updatable here — they
// are derived from ledger history and creation time respectively.
export async function updateCustomerFields(
  businessId: string,
  customerId: string,
  updates: Partial<
    Omit<Customer, "id" | "businessId" | "totalDue" | "createdAt">
  >
): Promise<Customer | null> {
  const db = await getDb();
  return db.collection<Customer>("customers").findOneAndUpdate(
    { id: customerId, businessId },
    { $set: updates },
    { returnDocument: "after" }
  );
}

export async function customerHasLedgerEntries(
  businessId: string,
  customerId: string
): Promise<boolean> {
  const db = await getDb();
  const existing = await db
    .collection<LedgerEntry>("ledgerEntries")
    .findOne({ businessId, customerId }, { projection: { id: 1 } });
  return existing !== null;
}

export async function deleteCustomer(
  businessId: string,
  customerId: string
): Promise<boolean> {
  const db = await getDb();
  const result = await db
    .collection<Customer>("customers")
    .deleteOne({ id: customerId, businessId });
  return result.deletedCount === 1;
}

// ── Ledger: read ────────────────────────────────────────────────

export async function getLedgerEntries(
  businessId: string,
  customerId: string
): Promise<LedgerEntry[]> {
  const db = await getDb();
  return db
    .collection<LedgerEntry>("ledgerEntries")
    .find({ businessId, customerId })
    .sort({ date: -1, createdAt: -1 })
    .toArray();
}

// ── Ledger: record payment (transactional) ──────────────────────

export interface RecordPaymentInput {
  businessId: string;
  customerId: string;
  amount: number;
  date: string;
  note?: string;
}

export type RecordPaymentErrorCode = "CUSTOMER_NOT_FOUND" | "INVALID_AMOUNT";

export type RecordPaymentResult =
  | { success: true; payment: LedgerEntry; customer: Customer }
  | { success: false; code: RecordPaymentErrorCode };

export async function recordCustomerPayment(
  input: RecordPaymentInput
): Promise<RecordPaymentResult> {
  const { businessId, customerId, amount, date, note } = input;

  try {
    const result = await withTransaction(async (session) => {
      const db = await getDb();
      const customers = db.collection<Customer>("customers");
      const ledger = db.collection<LedgerEntry>("ledgerEntries");

      const customer = await customers.findOne(
        { id: customerId, businessId },
        { session }
      );
      if (!customer) throw new ValidationError("CUSTOMER_NOT_FOUND");

      // Payment can't exceed what's actually owed, and can't be zero or
      // negative. Over-payment ("advance") isn't modeled in v1 — if it's
      // ever needed, add a distinct entry type and a signed balance model.
      if (amount <= 0 || amount > customer.totalDue) {
        throw new ValidationError("INVALID_AMOUNT");
      }

      const newBalance = customer.totalDue - amount;
      const now = new Date().toISOString();

      const payment: LedgerEntry = {
        id: crypto.randomUUID(),
        businessId,
        customerId,
        type: "payment",
        amount,
        date,
        balanceAfter: newBalance,
        createdAt: now,
      };
      if (note) payment.note = note;

      const updated = await customers.findOneAndUpdate(
        { id: customerId, businessId },
        { $set: { totalDue: newBalance } },
        { returnDocument: "after", session }
      );
      if (!updated) throw new ValidationError("CUSTOMER_NOT_FOUND");

      await ledger.insertOne(payment, { session });

      return { payment, customer: updated };
    });

    return { success: true, ...result };
  } catch (err) {
    if (err instanceof ValidationError) {
      return { success: false, code: err.code as RecordPaymentErrorCode };
    }
    throw err;
  }
}