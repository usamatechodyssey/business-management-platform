// app/api/billing/plans/route.ts
//
// GET — active plan tiers (customer-facing). Excludes the trial plan,
// which is not purchasable.

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { listActivePlans } from "@/lib/plans";

export async function GET() {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "settings.manage")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const all = await listActivePlans();
  const purchasable = all.filter((p) => !p.isTrialPlan);
  return apiSuccess({ plans: purchasable });
}