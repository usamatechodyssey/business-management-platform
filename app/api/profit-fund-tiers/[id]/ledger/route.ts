// app/api/profit-fund-tiers/[id]/ledger/route.ts
//
// GET ?range=month  or  ?range=custom&from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns the tier's rate period ledger for the resolved range.
// Requires "profitFund.view".

import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { requireTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { getTierById } from "@/lib/profit-fund";
import { resolveRange } from "@/lib/dashboard";
import { buildTierLedger } from "@/lib/tier-ledger";

export async function GET(
  req: NextRequest,
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

  const search = req.nextUrl.searchParams;
  const preset = search.get("range")?.trim() || undefined;
  const from = search.get("from")?.trim() || undefined;
  const to = search.get("to")?.trim() || undefined;

  const range = resolveRange(preset, from, to);

  const report = await buildTierLedger(
    tenant.businessId,
    tier,
    range.from.slice(0, 10),
    range.to.slice(0, 10)
  );

  return apiSuccess(report);
}