// app/api/admin/tenants/[id]/route.ts
//
// GET    — tenant detail with per-collection counts
// PATCH  — { action: "suspend" | "activate", reason? }
// DELETE — soft-delete the tenant (sets a deletedAt marker; does not
//          remove data — hard delete is a separate, privileged op).

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/validate";
import { requireAdmin } from "@/lib/admin-auth";
import {
  activateTenant,
  getTenantDetail,
  suspendTenant,
  writeAdminAction,
} from "@/lib/admin-db";
import { getDb } from "@/lib/db";
import type { Business } from "@/types";

const patchSchema = z.object({
  action: z.enum(["suspend", "activate"]),
  reason: z.string().trim().max(200).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.success) return guard.response;

  const { id } = await params;
  const detail = await getTenantDetail(id);
  if (!detail) return apiError("Tenant not found.", 404);

  return apiSuccess(detail);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.success) return guard.response;
  const { admin } = guard;

  const { id } = await params;

  const parsed = await parseJsonBody(req, patchSchema);
  if (!parsed.success) return parsed.response;
  const { action, reason } = parsed.data;

  const detail = await getTenantDetail(id);
  if (!detail) return apiError("Tenant not found.", 404);

  if (action === "suspend") {
    const updated = await suspendTenant(id, reason, admin.adminId);
    if (!updated) return apiError("Tenant not found.", 404);

    await writeAdminAction({
      adminId: admin.adminId,
      adminName: admin.name,
      type: "tenant.suspend",
      targetBusinessId: id,
      targetBusinessName: detail.business.name,
      metadata: reason ? { reason } : undefined,
    });

    return apiSuccess(updated);
  }

  const updated = await activateTenant(id, admin.adminId);
  if (!updated) return apiError("Tenant not found.", 404);

  await writeAdminAction({
    adminId: admin.adminId,
    adminName: admin.name,
    type: "tenant.activate",
    targetBusinessId: id,
    targetBusinessName: detail.business.name,
  });

  return apiSuccess(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.success) return guard.response;
  const { admin } = guard;

  const { id } = await params;
  const detail = await getTenantDetail(id);
  if (!detail) return apiError("Tenant not found.", 404);

  // Soft delete: mark the tenant as deleted so it drops out of the list
  // but its data survives for audit. Business login is blocked by the
  // `deletedAt` check we'll add in the gating batch.
  const db = await getDb();
  const now = new Date().toISOString();
  const updated = await db
    .collection<Business>("businesses")
    .findOneAndUpdate(
      { id },
      { $set: { deletedAt: now, "subscription.status": "expired" } },
      { returnDocument: "after" }
    );

  await writeAdminAction({
    adminId: admin.adminId,
    adminName: admin.name,
    type: "tenant.delete",
    targetBusinessId: id,
    targetBusinessName: detail.business.name,
  });

  return apiSuccess(updated);
}