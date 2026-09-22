// app/api/users/route.ts
//
// GET  — list staff for the tenant (requires "staff.manage")
// POST — create a staff user (requires "staff.manage")
//
// Field-level validation lives client-side (StaffFormModal) with the
// user's locale; the server-side Zod schema is a security backstop.
// Cross-cutting checks (duplicate phone/email — global scope, plan
// limit) return a translatable `code`.

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/validate";
import { requireTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { hashPassword } from "@/lib/auth";
import { checkResourceLimit } from "@/lib/limits";
import { requireActiveTenant } from "@/lib/subscription-guard";
import {
  insertUser,
  isEmailTaken,
  isPhoneTaken,
  listStaff,
  toSafeUser,
} from "@/lib/staff";
import type { User } from "@/types";

const emptyToUndefined = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

// z.enum needs a tuple type, not a readonly array, so spell it out.
// Kept in sync with ASSIGNABLE_ROLES in lib/staff.ts manually.
const assignableRoleSchema = z.enum(["manager", "cashier", "accountant"]);

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(10).max(20),
  email: z.preprocess(
    emptyToUndefined,
    z.string().email().max(254).optional()
  ),
  password: z
    .string()
    .min(8)
    .regex(/[A-Za-z]/, "Password must contain a letter.")
    .regex(/\d/, "Password must contain a number."),
  role: assignableRoleSchema,
});

export async function GET() {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "staff.manage")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const users = await listStaff(tenant.businessId);
  return apiSuccess({ users: users.map(toSafeUser) });
}

export async function POST(req: NextRequest) {
  const tenantResult = await requireActiveTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "staff.manage")) {
    return apiError("You don't have permission to do this.", 403);
  }

  // Plan-limit gate — runs before any insert or uniqueness check.
  const limit = await checkResourceLimit(tenant.businessId, "users");
  if (!limit.allowed) {
    return apiError(
      "You've reached the staff limit for your plan.",
      403,
      {
        code: "LIMIT_REACHED",
        fields: {
          resource: "users",
          current: String(limit.current),
          limit: String(limit.limit),
        },
      }
    );
  }

  const parsed = await parseJsonBody(req, createUserSchema);
  if (!parsed.success) return parsed.response;

  const { name, phone, email, password, role } = parsed.data;

  // Global uniqueness — these are login identifiers.
  if (await isPhoneTaken(phone)) {
    return apiError("Phone number is already registered.", 409, {
      code: "PHONE_TAKEN",
    });
  }
  if (email && (await isEmailTaken(email))) {
    return apiError("Email is already registered.", 409, {
      code: "EMAIL_TAKEN",
    });
  }

  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);

  const user: User = {
    id: crypto.randomUUID(),
    businessId: tenant.businessId,
    name,
    phone,
    role,
    passwordHash,
    active: true,
    createdAt: now,
  };
  if (email) user.email = email;

  await insertUser(user);

  return apiSuccess(toSafeUser(user), 201);
}