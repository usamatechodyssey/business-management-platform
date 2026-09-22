// app/api/admin/tenants/[id]/impersonate/route.ts
//
// POST   — begin impersonating: sets the *business* session cookie
//          using the tenant owner's identity.
// DELETE — end impersonation: clears the business session cookie. The
//          admin's own session cookie is untouched.

import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import {
  requireAdmin,
  startImpersonation,
  stopImpersonation,
} from "@/lib/admin-auth";
import { getOwnerForTenant, getTenantDetail, writeAdminAction } from "@/lib/admin-db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.success) return guard.response;
  const { admin } = guard;

  const { id } = await params;

  // Fetch both owner and tenant detail — owner for identity, detail
  // for the business name that goes into the audit log.
  const [owner, detail] = await Promise.all([
    getOwnerForTenant(id),
    getTenantDetail(id),
  ]);

  if (!detail) return apiError("Tenant not found.", 404);
  if (!owner) {
    return apiError("No active owner found for this tenant.", 404);
  }

  await startImpersonation({
    businessId: id,
    ownerUserId: owner.id,
    ownerName: owner.name,
    ownerRole: owner.role,
  });

  await writeAdminAction({
    adminId: admin.adminId,
    adminName: admin.name,
    type: "tenant.impersonate",
    targetBusinessId: id,
    targetBusinessName: detail.business.name,
  });

  return apiSuccess({ impersonating: true, businessId: id });
}

export async function DELETE() {
  const guard = await requireAdmin();
  if (!guard.success) return guard.response;

  await stopImpersonation();
  return apiSuccess({ impersonating: false });
}