// app/api/customers/[id]/route.ts
//
// GET    — read a customer (requires "customers.view")
// PATCH  — update name / phone / address / khata fields (requires
//          "customers.manage"). `totalDue` is derived from ledger history
//          and never writable through this endpoint.
// DELETE — remove a customer, refused if any ledger entries reference it
//          (requires "customers.manage"). Keeps the append-only ledger
//          honest — a customer with history must be kept.
//
// Tenant isolation: every query is scoped by businessId; a cross-tenant
// id returns 404, never 403.

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/validate";
import { requireTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import {
  customerHasLedgerEntries,
  deleteCustomer,
  getCustomerById,
  isCustomerPhoneTaken,
  updateCustomerFields,
} from "@/lib/customers";

const emptyToUndefined = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

const optionalNonNegativeNumber = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.number().min(0).optional()
);

const updateCustomerSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().min(10).max(20).optional(),
  address: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
  creditLimit: optionalNonNegativeNumber,
  dueDate: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
  ),
  guarantorName: z.preprocess(
    emptyToUndefined,
    z.string().max(100).optional()
  ),
  guarantorPhone: z.preprocess(
    emptyToUndefined,
    z.string().max(20).optional()
  ),
  tag: z.preprocess(emptyToUndefined, z.string().max(50).optional()),
  notes: z.preprocess(emptyToUndefined, z.string().max(500).optional()),
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

  return apiSuccess(customer);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "customers.manage")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const { id } = await params;

  const parsed = await parseJsonBody(req, updateCustomerSchema);
  if (!parsed.success) return parsed.response;
  const updates = parsed.data;

  if (Object.keys(updates).length === 0) {
    return apiError("No fields to update.", 400);
  }

  // Fetch first so nonexistent / foreign ids 404 before any uniqueness
  // check runs, and so we can skip the phone check when it hasn't changed.
  const existing = await getCustomerById(tenant.businessId, id);
  if (!existing) return apiError("Customer not found.", 404);

  if (updates.phone && updates.phone !== existing.phone) {
    const taken = await isCustomerPhoneTaken(
      tenant.businessId,
      updates.phone,
      id
    );
    if (taken) {
      return apiError("Customer phone is already registered.", 409, {
        code: "CUSTOMER_PHONE_TAKEN",
      });
    }
  }

  const updated = await updateCustomerFields(tenant.businessId, id, updates);
  if (!updated) return apiError("Customer not found.", 404);

  return apiSuccess(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "customers.manage")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const { id } = await params;

  // Verify existence first so a foreign / bogus id returns the same 404
  // as "not found", not "has ledger entries".
  const existing = await getCustomerById(tenant.businessId, id);
  if (!existing) return apiError("Customer not found.", 404);

  if (await customerHasLedgerEntries(tenant.businessId, id)) {
    return apiError(
      "This customer has ledger history and cannot be deleted.",
      409,
      { code: "CUSTOMER_HAS_LEDGER_ENTRIES" }
    );
  }

  const deleted = await deleteCustomer(tenant.businessId, id);
  if (!deleted) return apiError("Customer not found.", 404);

  return apiSuccess({ deleted: true });
}