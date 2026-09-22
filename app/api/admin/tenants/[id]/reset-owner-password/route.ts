// app/api/admin/tenants/[id]/reset-owner-password/route.ts

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/validate";
import { requireAdmin } from "@/lib/admin-auth";
import {
  getTenantDetail,
  resetOwnerPassword,
  writeAdminAction,
} from "@/lib/admin-db";

const resetSchema = z.object({
  newPassword: z
    .string()
    .min(8)
    .regex(/[A-Za-z]/)
    .regex(/\d/),
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

  const parsed = await parseJsonBody(req, resetSchema);
  if (!parsed.success) return parsed.response;

  const ok = await resetOwnerPassword(id, parsed.data.newPassword);
  if (!ok) return apiError("Owner account not found.", 404);

  await writeAdminAction({
    adminId: admin.adminId,
    adminName: admin.name,
    type: "tenant.resetOwnerPassword",
    targetBusinessId: id,
    targetBusinessName: detail.business.name,
  });

  return apiSuccess({ reset: true });
}