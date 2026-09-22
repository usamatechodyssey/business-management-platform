// app/api/users/[id]/route.ts
//
// GET    — read a staff user (requires "staff.manage")
// PATCH  — update name / phone / email / role / active / password
//          (requires "staff.manage")
// DELETE — archive (soft delete, active: false) (requires "staff.manage")
//
// Owner protection — cannot delete, cannot change role, cannot
// deactivate. Self-protection — cannot change own role or active status
// via this endpoint, cannot delete self. There's exactly one owner per
// business (created by register, never assignable here).
//
// Tenant isolation: every query is scoped by businessId; a cross-tenant
// id returns 404, never 403.

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/validate";
import { requireTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import {
  archiveUser,
  getStaffById,
  isEmailTaken,
  isPhoneTaken,
  toSafeUser,
  updateUser,
} from "@/lib/staff";

const emptyToUndefined = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

const assignableRoleSchema = z.enum(["manager", "cashier", "accountant"]);

const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().min(10).max(20).optional(),
  email: z.preprocess(
    emptyToUndefined,
    z.string().email().max(254).optional()
  ),
  password: z
    .string()
    .min(8)
    .regex(/[A-Za-z]/)
    .regex(/\d/)
    .optional(),
  role: assignableRoleSchema.optional(),
  active: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "staff.manage")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const { id } = await params;
  const user = await getStaffById(tenant.businessId, id);
  if (!user) return apiError("User not found.", 404);

  return apiSuccess(toSafeUser(user));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "staff.manage")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const { id } = await params;

  const parsed = await parseJsonBody(req, updateUserSchema);
  if (!parsed.success) return parsed.response;
  const updates = parsed.data;

  if (Object.keys(updates).length === 0) {
    return apiError("No fields to update.", 400);
  }

  const target = await getStaffById(tenant.businessId, id);
  if (!target) return apiError("User not found.", 404);

  // ── Owner protection ────────────────────────────────────────
  // The owner's role and active status are locked, and the owner can
  // never be assigned to a different user (role enum already excludes
  // "owner", so this is belt-and-braces).
  if (target.role === "owner") {
    if (updates.role !== undefined) {
      return apiError("The owner's role cannot be changed.", 422, {
        code: "OWNER_ROLE_LOCKED",
      });
    }
    if (updates.active === false) {
      return apiError("The owner cannot be deactivated.", 422, {
        code: "OWNER_PROTECTED",
      });
    }
  }

  // ── Self-protection ─────────────────────────────────────────
  // Even an owner acting on their own record can't change their own
  // role or active flag through this endpoint (that's a different,
  // future "transfer ownership" flow).
  if (target.id === tenant.userId) {
    if (updates.role !== undefined) {
      return apiError("You cannot change your own role.", 422, {
        code: "SELF_ROLE_LOCKED",
      });
    }
    if (updates.active !== undefined) {
      return apiError(
        "You cannot change your own active status.",
        422,
        { code: "SELF_ACTIVE_LOCKED" }
      );
    }
  }

  // ── Uniqueness (global) ─────────────────────────────────────
  if (updates.phone && updates.phone !== target.phone) {
    if (await isPhoneTaken(updates.phone, target.id)) {
      return apiError("Phone number is already registered.", 409, {
        code: "PHONE_TAKEN",
      });
    }
  }
  if (updates.email && updates.email !== target.email) {
    if (await isEmailTaken(updates.email, target.id)) {
      return apiError("Email is already registered.", 409, {
        code: "EMAIL_TAKEN",
      });
    }
  }

  // ── Apply ───────────────────────────────────────────────────
  const updated = await updateUser(tenant.businessId, id, {
    name: updates.name,
    email: updates.email,
    phone: updates.phone,
    role: updates.role,
    active: updates.active,
    newPassword: updates.password,
  });
  if (!updated) return apiError("User not found.", 404);

  return apiSuccess(toSafeUser(updated));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "staff.manage")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const { id } = await params;

  const target = await getStaffById(tenant.businessId, id);
  if (!target) return apiError("User not found.", 404);

  if (target.role === "owner") {
    return apiError("The owner cannot be deleted.", 422, {
      code: "OWNER_PROTECTED",
    });
  }
  if (target.id === tenant.userId) {
    return apiError("You cannot delete your own account.", 422, {
      code: "SELF_DELETE_LOCKED",
    });
  }

  const archived = await archiveUser(tenant.businessId, id);
  if (!archived) return apiError("User not found.", 404);

  return apiSuccess(toSafeUser(archived));
}