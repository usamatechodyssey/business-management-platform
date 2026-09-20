// app/api/products/[id]/route.ts
//
// GET    — read a product by id (requires "inventory.view")
// PATCH  — update a product's fields or archive/unarchive via `active`
//          (requires "inventory.manage")
// DELETE — archive (soft delete): sets `active: false` (requires
//          "inventory.manage"). Historical sales keep the reference.
//
// Tenant isolation: every query is scoped by businessId from the session;
// a cross-tenant id returns 404, never 403, so we don't confirm existence.

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/validate";
import { requireTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import {
  getProductById,
  isProductCodeTaken,
  setProductActive,
  updateProductFields,
} from "@/lib/products";

const emptyToUndefined = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

// All fields optional — this is a PATCH. Zod strips absent optionals, so
// Object.keys(parsed.data) reflects exactly what the caller sent.
const updateProductSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  code: z.string().trim().min(1).max(50).optional(),
  category: z.preprocess(emptyToUndefined, z.string().max(50).optional()),
  unit: z.preprocess(emptyToUndefined, z.string().max(20).optional()),
  stockQty: z.number().int().min(0).optional(),
  costPrice: z.number().min(0).optional(),
  sellPrice: z.number().min(0).optional(),
  lowStockThreshold: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.number().int().min(0).optional()
  ),
  active: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "inventory.view")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const { id } = await params;
  const product = await getProductById(tenant.businessId, id);
  if (!product) return apiError("Product not found.", 404);

  return apiSuccess(product);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "inventory.manage")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const { id } = await params;

  const parsed = await parseJsonBody(req, updateProductSchema);
  if (!parsed.success) return parsed.response;
  const updates = parsed.data;

  if (Object.keys(updates).length === 0) {
    return apiError("No fields to update.", 400);
  }

  // Fetch first so a nonexistent/foreign id 404s before we run any
  // uniqueness checks or writes.
  const existing = await getProductById(tenant.businessId, id);
  if (!existing) return apiError("Product not found.", 404);

  if (updates.code && updates.code !== existing.code) {
    const taken = await isProductCodeTaken(tenant.businessId, updates.code, id);
    if (taken) {
      return apiError("Product code is already in use.", 409, {
        code: "PRODUCT_CODE_TAKEN",
      });
    }
  }

  const updated = await updateProductFields(tenant.businessId, id, updates);
  if (!updated) return apiError("Product not found.", 404);

  return apiSuccess(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "inventory.manage")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const { id } = await params;
  const archived = await setProductActive(tenant.businessId, id, false);
  if (!archived) return apiError("Product not found.", 404);

  return apiSuccess(archived);
}