import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/validate";
import { verifyPassword, createSessionToken, setSessionCookie } from "@/lib/auth";
import type { User } from "@/types";

const loginSchema = z.object({
  identifier: z.string().min(3, "Phone or email is required."),
  password: z.string().min(1, "Password is required."),
});

export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req, loginSchema);
  if (!parsed.success) return parsed.response;

  const { identifier, password } = parsed.data;
  const db = await getDb();
  const user = await db.collection<User>("users").findOne({
    active: true,
    $or: [{ phone: identifier }, { email: identifier }],
  });

  if (!user) {
    return apiError("Invalid phone/email or password.", 401, {
      code: "INVALID_CREDENTIALS",
    });
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) {
    return apiError("Invalid phone/email or password.", 401, {
      code: "INVALID_CREDENTIALS",
    });
  }

  const token = await createSessionToken({
    userId: user.id,
    businessId: user.businessId,
    role: user.role,
    name: user.name,
  });
  await setSessionCookie(token);

  await db.collection<User>("users").updateOne(
    { id: user.id },
    { $set: { lastLogin: new Date().toISOString() } }
  );

  return apiSuccess({ id: user.id, name: user.name, role: user.role, businessId: user.businessId });
}