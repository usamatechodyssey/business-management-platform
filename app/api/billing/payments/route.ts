// app/api/billing/payments/route.ts
//
// GET  — own tenant's payment history (requires settings.manage)
// POST — submit a new payment for admin review (requires settings.manage)
//
// The plan slug is resolved server-side; the amount is derived from the
// plan's current monthly price × months. The client only sends the slug
// + months — never the amount.

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/validate";
import { requireTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { getDb } from "@/lib/db";
import { calculateAmount } from "@/lib/pricing";
import { getPlanBySlug } from "@/lib/plans";
import { createPayment, listPayments } from "@/lib/payments";
import type { Business, Payment } from "@/types";

const MAX_PENDING = 3;

const emptyToUndefined = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

const submitSchema = z.object({
  planSlug: z.string().trim().min(1).max(30),
  months: z.union([
    z.literal(1),
    z.literal(3),
    z.literal(6),
    z.literal(12),
  ]),
  method: z.enum(["jazzcash", "easypaisa", "bank", "other"]),
  transactionId: z.preprocess(
    emptyToUndefined,
    z.string().max(50).optional()
  ),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.preprocess(emptyToUndefined, z.string().max(300).optional()),
});

export async function GET() {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "settings.manage")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const result = await listPayments({
    businessId: tenant.businessId,
    page: 1,
  });

  return apiSuccess({ payments: result.payments });
}

export async function POST(req: NextRequest) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "settings.manage")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const parsed = await parseJsonBody(req, submitSchema);
  if (!parsed.success) return parsed.response;
  const { planSlug, months, method, transactionId, paidAt, notes } = parsed.data;

  // Resolve the plan from the DB. The client can't spoof prices because
  // amount is derived here, not passed in.
  const plan = await getPlanBySlug(planSlug);
  if (!plan || !plan.active) {
    return apiError("Selected plan is not available.", 422, {
      code: "PLAN_NOT_FOUND",
    });
  }
  if (plan.isTrialPlan) {
    return apiError("The trial plan cannot be purchased.", 422, {
      code: "PLAN_NOT_PURCHASABLE",
    });
  }

  const db = await getDb();

  const pendingCount = await db
    .collection<Payment>("payments")
    .countDocuments({
      businessId: tenant.businessId,
      status: "pending",
    });
  if (pendingCount >= MAX_PENDING) {
    return apiError(
      "You already have pending payments waiting for review.",
      429,
      { code: "TOO_MANY_PENDING" }
    );
  }

  const business = await db
    .collection<Business>("businesses")
    .findOne({ id: tenant.businessId });
  if (!business) {
    return apiError("Business not found.", 404);
  }

  const payment = await createPayment({
    businessId: tenant.businessId,
    businessName: business.name,
    ownerName: business.ownerName,
    ownerPhone: business.phone,
    plan: plan.slug,
    months,
    amount: calculateAmount(plan.priceMonthly, months),
    method,
    transactionId,
    paidAt,
    notes,
  });

  return apiSuccess(payment, 201);
}