// app/api/admin/auth/logout/route.ts

import { apiSuccess } from "@/lib/api-response";
import { clearAdminSessionCookie, getAdminSession } from "@/lib/admin-auth";
import { writeAdminAction } from "@/lib/admin-db";

export async function POST() {
  const session = await getAdminSession();
  if (session) {
    await writeAdminAction({
      adminId: session.adminId,
      adminName: session.name,
      type: "admin.logout",
    });
  }
  await clearAdminSessionCookie();
  return apiSuccess({ loggedOut: true });
}