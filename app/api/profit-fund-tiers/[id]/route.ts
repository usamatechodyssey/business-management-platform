// app/api/profit-fund-tiers/[id]/route.ts
//
// GET    — read a tier (requires "profitFund.view")
// PATCH  — update name / percentage / enabled (requires "profitFund.manage").
//          A percentage change appends a new rate row in a transaction —
//          history is never overwritten.
// DELETE — remove a tier (requires "profitFund.manage"), refused if any
//          disbursements exist.

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/validate";
import { requireTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import {
  deleteTier,
  getTierById,
  isTierNameTaken,
  tierHasDisbursements,
  updateTierWithRate,
} from "@/lib/profit-fund";

const updateTierSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  percentage: z.number().gt(0).lte(100).optional(),
  enabled: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "profitFund.view")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const { id } = await params;
  const tier = await getTierById(tenant.businessId, id);
  if (!tier) return apiError("Tier not found.", 404);

  return apiSuccess(tier);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "profitFund.manage")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const { id } = await params;

  const parsed = await parseJsonBody(req, updateTierSchema);
  if (!parsed.success) return parsed.response;
  const updates = parsed.data;

  if (Object.keys(updates).length === 0) {
    return apiError("No fields to update.", 400);
  }

  const existing = await getTierById(tenant.businessId, id);
  if (!existing) return apiError("Tier not found.", 404);

  if (updates.name && updates.name !== existing.name) {
    const taken = await isTierNameTaken(tenant.businessId, updates.name, id);
    if (taken) {
      return apiError("A tier with this name already exists.", 409, {
        code: "TIER_NAME_TAKEN",
      });
    }
  }

  const updated = await updateTierWithRate(tenant.businessId, id, updates);
  if (!updated) return apiError("Tier not found.", 404);

  return apiSuccess(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "profitFund.manage")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const { id } = await params;

  const existing = await getTierById(tenant.businessId, id);
  if (!existing) return apiError("Tier not found.", 404);

  if (await tierHasDisbursements(tenant.businessId, id)) {
    return apiError(
      "This tier has disbursement history and cannot be deleted.",
      409,
      { code: "TIER_HAS_DISBURSEMENTS" }
    );
  }

  const deleted = await deleteTier(tenant.businessId, id);
  if (!deleted) return apiError("Tier not found.", 404);

  return apiSuccess({ deleted: true });
}