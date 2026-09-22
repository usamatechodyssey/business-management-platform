// app/api/admin/auth/session/route.ts

import { apiSuccess, apiError } from "@/lib/api-response";
import { getAdminSession } from "@/lib/admin-auth";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return apiError("Not authenticated.", 401);
  return apiSuccess(session);
}