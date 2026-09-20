// app/api/businesses/[id]/route.ts
//
// GET   — read own business profile (any authenticated user in the tenant).
// PATCH — update own business profile (requires "settings.manage", i.e. owner).
//
// Tenant isolation: the URL `id` must equal the session's `businessId`.
// Mismatch returns 404 (not 403) so we never confirm the existence of
// another tenant's record. `assertOwnedByTenant` does not apply here —
// it checks a `businessId` field inside a child document, whereas the
// Business doc's own `id` IS the businessId.

import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/validate";
import { requireTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import type { Business } from "@/types";

// All fields optional — this is a PATCH, callers update only what changed.
// Zod strips absent optionals, so `Object.keys(parsed.data)` accurately
// reflects the fields the caller sent.
const updateBusinessSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Business name must be at least 2 characters.")
    .max(100, "Business name is too long.")
    .optional(),
  ownerName: z
    .string()
    .trim()
    .min(2, "Owner name must be at least 2 characters.")
    .max(100, "Owner name is too long.")
    .optional(),
  phone: z
    .string()
    .trim()
    .min(10, "Enter a valid phone number.")
    .max(20, "Phone number is too long.")
    .optional(),
  address: z
    .string()
    .trim()
    .max(200, "Address is too long.")
    .optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  const { id } = await params;

  // URL id must match the session tenant — a caller can only ever read
  // their own business document.
  if (id !== tenant.businessId) {
    return apiError("Business not found.", 404);
  }

  const db = await getDb();
  const business = await db
    .collection<Business>("businesses")
    .findOne({ id: tenant.businessId });

  if (!business) {
    return apiError("Business not found.", 404);
  }

  return apiSuccess(business);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  // Profile edits are a settings operation — owner only.
  if (!hasPermission(tenant.role, "settings.manage")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const { id } = await params;
  if (id !== tenant.businessId) {
    return apiError("Business not found.", 404);
  }

  const parsed = await parseJsonBody(req, updateBusinessSchema);
  if (!parsed.success) return parsed.response;

  const updates = parsed.data;
  if (Object.keys(updates).length === 0) {
    return apiError("No fields to update.", 400);
  }

  const db = await getDb();
  const updated = await db
    .collection<Business>("businesses")
    .findOneAndUpdate(
      { id: tenant.businessId },
      { $set: updates },
      { returnDocument: "after" }
    );

  if (!updated) {
    // The session is valid but the business doc vanished between the
    // requireTenant() check and the update — return 404 rather than a
    // 500, since the resource the caller addressed is not there.
    return apiError("Business not found.", 404);
  }

  return apiSuccess(updated);
}