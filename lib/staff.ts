// lib/staff.ts
//
// Server-only staff management logic. Every staff operation is scoped to
// a business; login identifiers (phone, email) are checked globally
// because authentication happens before tenant resolution.
//
// Owner protection is enforced at the API layer (not here) because it
// depends on the caller's identity and role, which live in the session —
// not in this data-access module. This file exposes the primitives; the
// routes compose them with the rules.

import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import type { SafeUser, User, UserRole } from "@/types";

// Roles that can be assigned via the staff API. "owner" is deliberately
// excluded — the owner is created only by the register flow, and there's
// exactly one per business.
export const ASSIGNABLE_ROLES: readonly UserRole[] = [
  "manager",
  "cashier",
  "accountant",
] as const;


export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    businessId: user.businessId,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt,
    lastLogin: user.lastLogin,
  };
}

// ── Read ────────────────────────────────────────────────────────

// Owner first (role sort: accountant, cashier, manager, owner — but we
// want owner on top), then alphabetical. Owner-first is more useful in
// the staff table than alphabetical.
export async function listStaff(businessId: string): Promise<User[]> {
  const db = await getDb();
  const users = await db
    .collection<User>("users")
    .find({ businessId })
    .sort({ name: 1 })
    .toArray();

  // Hoist owner to the top.
  return users.sort((a, b) => {
    if (a.role === "owner" && b.role !== "owner") return -1;
    if (a.role !== "owner" && b.role === "owner") return 1;
    return 0;
  });
}

export async function getStaffById(
  businessId: string,
  userId: string
): Promise<User | null> {
  const db = await getDb();
  return db.collection<User>("users").findOne({ id: userId, businessId });
}

// ── Uniqueness ──────────────────────────────────────────────────
//
// Global scope, not per-tenant — the login route looks up by
// phone/email with no businessId filter, so identifiers must be unique
// across the whole users collection.

export async function isEmailTaken(
  email: string,
  excludeId?: string
): Promise<boolean> {
  const db = await getDb();
  const filter: Record<string, unknown> = { email };
  if (excludeId) filter.id = { $ne: excludeId };
  const existing = await db
    .collection<User>("users")
    .findOne(filter, { projection: { id: 1 } });
  return existing !== null;
}

export async function isPhoneTaken(
  phone: string,
  excludeId?: string
): Promise<boolean> {
  const db = await getDb();
  const filter: Record<string, unknown> = { phone };
  if (excludeId) filter.id = { $ne: excludeId };
  const existing = await db
    .collection<User>("users")
    .findOne(filter, { projection: { id: 1 } });
  return existing !== null;
}

// ── Write ───────────────────────────────────────────────────────

export async function insertUser(user: User): Promise<void> {
  const db = await getDb();
  await db.collection<User>("users").insertOne(user);
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  phone?: string;
  role?: UserRole;
  active?: boolean;
  newPassword?: string;
}

// Single update entry point. Field-level "not provided" is `undefined`;
// once you destructure the update payload in the route, only fields the
// caller actually sent remain. Password is hashed here so raw values
// never reach the DB.
export async function updateUser(
  businessId: string,
  userId: string,
  updates: UpdateUserInput
): Promise<User | null> {
  const db = await getDb();

  const setFields: Record<string, unknown> = {};
  if (updates.name !== undefined) setFields.name = updates.name;
  if (updates.email !== undefined) setFields.email = updates.email;
  if (updates.phone !== undefined) setFields.phone = updates.phone;
  if (updates.role !== undefined) setFields.role = updates.role;
  if (updates.active !== undefined) setFields.active = updates.active;

  if (updates.newPassword !== undefined) {
    setFields.passwordHash = await hashPassword(updates.newPassword);
  }

  if (Object.keys(setFields).length === 0) return null;

  return db
    .collection<User>("users")
    .findOneAndUpdate(
      { id: userId, businessId },
      { $set: setFields },
      { returnDocument: "after" }
    );
}

// Archive = soft delete. The user record survives for audit trails
// (sales record "recorded by user X"), but login is blocked because
// /api/auth/login filters on active: true.
export async function archiveUser(
  businessId: string,
  userId: string
): Promise<User | null> {
  return updateUser(businessId, userId, { active: false });
}