// app/api/admin/tenants/[id]/grant/route.ts
//
// Manual subscription grant — bypasses payment. Used for comps, trial
// extensions, and payment-adjacent fixes. The plan slug is validated
// against the planTiers collection.

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/validate";
import { requireAdmin } from "@/lib/admin-auth";
import { getPlanBySlug } from "@/lib/plans";
import { getTenantDetail, grantSubscription, writeAdminAction } from "@/lib/admin-db";

const grantSchema = z.object({
  months: z.number().int().min(1).max(36),
  plan: z.string().trim().min(1).max(30),
  notes: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed === "" ? undefined : trimmed;
    },
    z.string().max(200).optional()
  ),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.success) return guard.response;
  const { admin } = guard;

  const { id } = await params;
  const detail = await getTenantDetail(id);
  if (!detail) return apiError("Tenant not found.", 404);

  const parsed = await parseJsonBody(req, grantSchema);
  if (!parsed.success) return parsed.response;
  const { months, plan: planSlug, notes } = parsed.data;

  const plan = await getPlanBySlug(planSlug);
  if (!plan) {
    return apiError("Plan not found.", 404, { code: "PLAN_NOT_FOUND" });
  }

  const updated = await grantSubscription({
    businessId: id,
    months,
    plan: planSlug,
    notes,
    adminId: admin.adminId,
  });
  if (!updated) return apiError("Tenant not found.", 404);

  await writeAdminAction({
    adminId: admin.adminId,
    adminName: admin.name,
    type: "tenant.grant",
    targetBusinessId: id,
    targetBusinessName: detail.business.name,
    metadata: { months, plan: planSlug },
  });

  return apiSuccess(updated);
}