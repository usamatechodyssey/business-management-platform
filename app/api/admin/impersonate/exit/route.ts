// app/api/admin/impersonate/exit/route.ts
//
// Ends an active impersonation session. Requires a valid admin session
// (the admin's own cookie is untouched during impersonation, so this
// always succeeds if the admin is still logged in).
//
// Clears both the business session cookie and the impersonation marker,
// leaving the admin's session intact.

import { apiSuccess } from "@/lib/api-response";
import { requireAdmin, stopImpersonation } from "@/lib/admin-auth";

export async function POST() {
  const guard = await requireAdmin();
  if (!guard.success) return guard.response;

  await stopImpersonation();
  return apiSuccess({ impersonating: false });
}