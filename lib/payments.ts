// lib/payments.ts
//
// Server-only payment submission + verification logic. Shared by the
// business-facing /api/billing/* routes and the admin-facing
// /api/admin/payments/* routes.
//
// Verification is transactional: setting a payment to "verified" and
// extending the tenant's subscription must both succeed or neither.
// A partial application would leave the ledger and the customer's
// access out of sync — the two states must be atomic.

import { getDb } from "@/lib/db";
import { withTransaction, ValidationError } from "@/lib/mongo-transaction";
import type {
  Business,
  BusinessSubscription,
  Payment,
  BillingMethod,
  PaymentStatus,
} from "@/types";

export const PAYMENTS_PAGE_SIZE = 25;

// ── Reference generation ────────────────────────────────────────
//
// Format: <first-letter-of-business>-<4 uppercase hex> e.g. "P-A3K9".
// Short enough for a customer to type into WhatsApp, and searchable by
// an admin looking at a chat. Collisions are checked against the
// payments collection; 10 retries cover ~1.6M combinations per letter.

async function generateUniqueReference(businessName: string): Promise<string> {
  const db = await getDb();
  const payments = db.collection<Payment>("payments");
  const prefix = businessName.trim().charAt(0).toUpperCase() || "P";

  for (let i = 0; i < 10; i++) {
    const bytes = crypto.getRandomValues(new Uint8Array(2));
    const suffix = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    const reference = `${prefix}-${suffix}`;
    const existing = await payments.findOne(
      { reference },
      { projection: { id: 1 } }
    );
    if (!existing) return reference;
  }
  throw new Error(
    "Failed to generate a unique payment reference after 10 attempts."
  );
}

// ── Create ──────────────────────────────────────────────────────

export interface CreatePaymentInput {
  businessId: string;
  businessName: string;
  ownerName: string;
  ownerPhone: string;
  plan: string;
  months: number;
  amount: number;
  method: BillingMethod;
  transactionId?: string;
  paidAt: string;
  notes?: string;
}

export async function createPayment(
  input: CreatePaymentInput
): Promise<Payment> {
  const db = await getDb();
  const reference = await generateUniqueReference(input.businessName);

  const payment: Payment = {
    id: crypto.randomUUID(),
    businessId: input.businessId,
    businessName: input.businessName,
    ownerName: input.ownerName,
    ownerPhone: input.ownerPhone,
    plan: input.plan,
    months: input.months,
    amount: input.amount,
    method: input.method,
    reference,
    paidAt: input.paidAt,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  if (input.transactionId) payment.transactionId = input.transactionId;
  if (input.notes) payment.notes = input.notes;

  await db.collection<Payment>("payments").insertOne(payment);
  return payment;
}

// ── Read ────────────────────────────────────────────────────────

export interface ListPaymentsInput {
  page?: number;
  status?: PaymentStatus;
  businessId?: string;
}

export interface ListPaymentsResult {
  payments: Payment[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export async function listPayments(
  input: ListPaymentsInput
): Promise<ListPaymentsResult> {
  const db = await getDb();
  const filter: Record<string, unknown> = {};
  if (input.status) filter.status = input.status;
  if (input.businessId) filter.businessId = input.businessId;

  const page = Math.max(1, Math.floor(input.page ?? 1));
  const skip = (page - 1) * PAYMENTS_PAGE_SIZE;
  const collection = db.collection<Payment>("payments");

  const [payments, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(PAYMENTS_PAGE_SIZE)
      .toArray(),
    collection.countDocuments(filter),
  ]);

  return {
    payments,
    page,
    pageSize: PAYMENTS_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAYMENTS_PAGE_SIZE)),
  };
}

export async function getPaymentById(
  paymentId: string
): Promise<Payment | null> {
  const db = await getDb();
  return db.collection<Payment>("payments").findOne({ id: paymentId });
}

export async function countPendingPayments(): Promise<number> {
  const db = await getDb();
  return db.collection<Payment>("payments").countDocuments({
    status: "pending",
  });
}

// ── Verify (transactional) ──────────────────────────────────────

export type VerifyPaymentErrorCode =
  | "NOT_FOUND"
  | "ALREADY_PROCESSED"
  | "BUSINESS_NOT_FOUND";

export type VerifyPaymentResult =
  | { success: true; payment: Payment; business: Business }
  | { success: false; code: VerifyPaymentErrorCode };

export async function verifyPayment(
  paymentId: string,
  adminId: string
): Promise<VerifyPaymentResult> {
  try {
    const result = await withTransaction(async (session) => {
      const db = await getDb();
      const payments = db.collection<Payment>("payments");
      const businesses = db.collection<Business>("businesses");

      const payment = await payments.findOne({ id: paymentId }, { session });
      if (!payment) throw new ValidationError("NOT_FOUND");
      if (payment.status !== "pending") {
        throw new ValidationError("ALREADY_PROCESSED");
      }

      const business = await businesses.findOne(
        { id: payment.businessId },
        { session }
      );
      if (!business) throw new ValidationError("BUSINESS_NOT_FOUND");

      const now = new Date();
      const currentExpiry = business.subscription?.expiresAt
        ? new Date(business.subscription.expiresAt)
        : null;
      const startFrom =
        currentExpiry && currentExpiry > now ? currentExpiry : now;

      const expiresAt = new Date(startFrom);
      expiresAt.setMonth(expiresAt.getMonth() + payment.months);

      const nextSubscription: BusinessSubscription = {
        status: "active",
        plan: payment.plan,
        startedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        lastGrantedBy: adminId,
        lastGrantedAt: now.toISOString(),
        notes: `Payment ${payment.reference}`,
      };

      const updatedBusiness = await businesses.findOneAndUpdate(
        { id: payment.businessId },
        {
          $set: { subscription: nextSubscription },
          $unset: { suspendedAt: "", suspendedReason: "" },
        },
        { returnDocument: "after", session }
      );
      if (!updatedBusiness) throw new ValidationError("BUSINESS_NOT_FOUND");

      const updatedPayment = await payments.findOneAndUpdate(
        { id: paymentId },
        {
          $set: {
            status: "verified",
            verifiedBy: adminId,
            verifiedAt: now.toISOString(),
          },
        },
        { returnDocument: "after", session }
      );
      if (!updatedPayment) throw new ValidationError("NOT_FOUND");

      return { payment: updatedPayment, business: updatedBusiness };
    });

    return { success: true, ...result };
  } catch (err) {
    if (err instanceof ValidationError) {
      return { success: false, code: err.code as VerifyPaymentErrorCode };
    }
    throw err;
  }
}

// ── Reject ──────────────────────────────────────────────────────

export type RejectPaymentErrorCode = "NOT_FOUND" | "ALREADY_PROCESSED";

export type RejectPaymentResult =
  | { success: true; payment: Payment }
  | { success: false; code: RejectPaymentErrorCode };

export async function rejectPayment(
  paymentId: string,
  adminId: string,
  reason: string
): Promise<RejectPaymentResult> {
  const db = await getDb();
  const payments = db.collection<Payment>("payments");

  const existing = await payments.findOne({ id: paymentId });
  if (!existing) return { success: false, code: "NOT_FOUND" };
  if (existing.status !== "pending") {
    return { success: false, code: "ALREADY_PROCESSED" };
  }

  const now = new Date().toISOString();
  const updated = await payments.findOneAndUpdate(
    { id: paymentId, status: "pending" },
    {
      $set: {
        status: "rejected",
        verifiedBy: adminId,
        verifiedAt: now,
        rejectionReason: reason,
      },
    },
    { returnDocument: "after" }
  );

  if (!updated) return { success: false, code: "ALREADY_PROCESSED" };
  return { success: true, payment: updated };
}