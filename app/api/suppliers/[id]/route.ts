// app/api/suppliers/[id]/route.ts
//
// GET    — read a supplier (requires "suppliers.view")
// PATCH  — update name / phone / address / contactPerson (requires
//          "suppliers.manage"). `totalOwed` is derived and never writable
//          through this endpoint — it only changes via purchases/payments.
// DELETE — remove a supplier, refused if any purchase references it
//          (requires "suppliers.manage"). Purchases must be deleted first
//          so stock and owed totals stay reconciled.
//
// Tenant isolation: every query is scoped by businessId; a cross-tenant id
// returns 404, never 403.

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/validate";
import { requireTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import {
  deleteSupplier,
  getSupplierById,
  isSupplierPhoneTaken,
  supplierHasPurchases,
  updateSupplierFields,
} from "@/lib/suppliers";

const emptyToUndefined = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

const updateSupplierSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().min(10).max(20).optional(),
  address: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
  contactPerson: z.preprocess(
    emptyToUndefined,
    z.string().max(100).optional()
  ),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "suppliers.view")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const { id } = await params;
  const supplier = await getSupplierById(tenant.businessId, id);
  if (!supplier) return apiError("Supplier not found.", 404);

  return apiSuccess(supplier);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "suppliers.manage")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const { id } = await params;

  const parsed = await parseJsonBody(req, updateSupplierSchema);
  if (!parsed.success) return parsed.response;
  const updates = parsed.data;

  if (Object.keys(updates).length === 0) {
    return apiError("No fields to update.", 400);
  }

  // Fetch first so nonexistent / foreign ids 404 before any uniqueness
  // check runs, and so we can skip the phone check when it hasn't changed.
  const existing = await getSupplierById(tenant.businessId, id);
  if (!existing) return apiError("Supplier not found.", 404);

  if (updates.phone && updates.phone !== existing.phone) {
    const taken = await isSupplierPhoneTaken(
      tenant.businessId,
      updates.phone,
      id
    );
    if (taken) {
      return apiError("Supplier phone is already registered.", 409, {
        code: "SUPPLIER_PHONE_TAKEN",
      });
    }
  }

  const updated = await updateSupplierFields(tenant.businessId, id, updates);
  if (!updated) return apiError("Supplier not found.", 404);

  return apiSuccess(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "suppliers.manage")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const { id } = await params;

  // Verify existence first so a foreign / bogus id returns the same 404
  // as "not found", not "has purchases".
  const existing = await getSupplierById(tenant.businessId, id);
  if (!existing) return apiError("Supplier not found.", 404);

  if (await supplierHasPurchases(tenant.businessId, id)) {
    return apiError(
      "This supplier has purchase records and cannot be deleted.",
      409,
      { code: "SUPPLIER_HAS_PURCHASES" }
    );
  }

  const deleted = await deleteSupplier(tenant.businessId, id);
  if (!deleted) return apiError("Supplier not found.", 404);

  return apiSuccess({ deleted: true });
}