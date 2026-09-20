import { getSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET() {
  const session = await getSession();
  if (!session) return apiError("Not authenticated.", 401);
  return apiSuccess(session);
}