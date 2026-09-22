// app/api/admin/auth/login/route.ts

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/validate";
import {
  createAdminSessionToken,
  setAdminSessionCookie,
  verifyAdminPassword,
} from "@/lib/admin-auth";
import { findAdminByEmail, touchAdminLastLogin, writeAdminAction } from "@/lib/admin-db";

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req, loginSchema);
  if (!parsed.success) return parsed.response;

  const { email, password } = parsed.data;
  const admin = await findAdminByEmail(email);

  if (!admin) {
    return apiError("Invalid email or password.", 401, {
      code: "INVALID_CREDENTIALS",
    });
  }

  const matches = await verifyAdminPassword(password, admin.passwordHash);
  if (!matches) {
    return apiError("Invalid email or password.", 401, {
      code: "INVALID_CREDENTIALS",
    });
  }

  const token = await createAdminSessionToken({
    adminId: admin.id,
    email: admin.email,
    name: admin.name,
  });
  await setAdminSessionCookie(token);
  await touchAdminLastLogin(admin.id);
  await writeAdminAction({
    adminId: admin.id,
    adminName: admin.name,
    type: "admin.login",
  });

  return apiSuccess({
    id: admin.id,
    name: admin.name,
    email: admin.email,
  });
}