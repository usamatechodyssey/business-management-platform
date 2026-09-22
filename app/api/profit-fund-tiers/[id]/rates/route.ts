// app/api/profit-fund-tiers/[id]/rates/route.ts
//
// GET — list the percentage change history for a tier, oldest first.
// Requires "profitFund.view".

import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { requireTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { getTierById, listTierRates } from "@/lib/profit-fund";

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

  const rates = await listTierRates(tenant.businessId, id);
  return apiSuccess({ tier, rates });
}