// app/api/profit-fund-tiers/route.ts
//
// GET  — list all tiers for the tenant (requires "profitFund.view")
// POST — create a tier (requires "profitFund.manage")
//
// Creating a tier also creates its initial rate row in a transaction,
// so rate-history-based calculations work from day one.

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/validate";
import { requireTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import {
  insertTierWithInitialRate,
  isTierNameTaken,
  listTiers,
} from "@/lib/profit-fund";

const createTierSchema = z.object({
  name: z.string().trim().min(1).max(50),
  percentage: z.number().gt(0).lte(100),
  enabled: z.boolean().optional(),
});

export async function GET() {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "profitFund.view")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const tiers = await listTiers(tenant.businessId);
  return apiSuccess({ tiers });
}

export async function POST(req: NextRequest) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "profitFund.manage")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const parsed = await parseJsonBody(req, createTierSchema);
  if (!parsed.success) return parsed.response;

  const { name, percentage, enabled } = parsed.data;

  if (await isTierNameTaken(tenant.businessId, name)) {
    return apiError("A tier with this name already exists.", 409, {
      code: "TIER_NAME_TAKEN",
    });
  }

  const tier = await insertTierWithInitialRate(
    tenant.businessId,
    name,
    percentage,
    enabled ?? true
  );

  return apiSuccess(tier, 201);
}