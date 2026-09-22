// app/api/customers/[id]/ledger/route.ts
//
// GET  — return the customer's ledger entries, newest first (requires
//        "customers.view").
// POST — record a payment against the customer's khata (requires
//        "customers.manage"). Runs inside a MongoDB transaction so
//        Customer.totalDue and the LedgerEntry row are always applied
//        atomically (see lib/customers.ts → recordCustomerPayment).
//
// Tenant isolation: customer must belong to the caller's business before
// any read/write runs; a cross-tenant id returns 404.

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/validate";
import { requireTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import {
  getCustomerById,
  getLedgerEntries,
  recordCustomerPayment,
} from "@/lib/customers";

const recordPaymentSchema = z.object({
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed === "" ? undefined : trimmed;
    },
    z.string().max(200).optional()
  ),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "customers.view")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const { id } = await params;

  const customer = await getCustomerById(tenant.businessId, id);
  if (!customer) return apiError("Customer not found.", 404);

  const entries = await getLedgerEntries(tenant.businessId, id);
  return apiSuccess({ customer, entries });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "customers.manage")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const { id: customerId } = await params;

  // Verify customer exists before running the transaction so a foreign
  // id returns a clean 404 instead of CUSTOMER_NOT_FOUND from deep inside.
  const customer = await getCustomerById(tenant.businessId, customerId);
  if (!customer) return apiError("Customer not found.", 404);

  const parsed = await parseJsonBody(req, recordPaymentSchema);
  if (!parsed.success) return parsed.response;
  const { amount, date, note } = parsed.data;

  const result = await recordCustomerPayment({
    businessId: tenant.businessId,
    customerId,
    amount,
    date,
    note,
  });

  if (!result.success) {
    if (result.code === "CUSTOMER_NOT_FOUND") {
      return apiError("Customer not found.", 404);
    }
    // INVALID_AMOUNT — <= 0 or greater than totalDue.
    return apiError(
      "Payment amount must be greater than zero and no more than the outstanding balance.",
      422,
      { code: "INVALID_PAYMENT_AMOUNT" }
    );
  }

  return apiSuccess(
    { payment: result.payment, customer: result.customer },
    201
  );
}