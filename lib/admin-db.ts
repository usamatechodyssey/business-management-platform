// lib/admin-db.ts
//
// Server-only data access for the admin dashboard. Every function here
// is called only from /api/admin/* routes or admin Server Components,
// which are already gated by requireAdmin().

import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import type {
  AdminAction,
  AdminActionType,
  AdminUser,
  Business,
  BusinessSubscription,
  Customer,
  Product,
  Purchase,
  Sale,
  Supplier,
  User,
} from "@/types";

export const ADMIN_PAGE_SIZE = 25;

// ── Admin users ─────────────────────────────────────────────────

export async function findAdminByEmail(email: string): Promise<AdminUser | null> {
  const db = await getDb();
  return db
    .collection<AdminUser>("adminUsers")
    .findOne({ email: email.trim().toLowerCase(), active: true });
}

export async function touchAdminLastLogin(adminId: string): Promise<void> {
  const db = await getDb();
  await db
    .collection<AdminUser>("adminUsers")
    .updateOne(
      { id: adminId },
      { $set: { lastLogin: new Date().toISOString() } }
    );
}

// ── Audit log ───────────────────────────────────────────────────

interface WriteAdminActionInput {
  adminId: string;
  adminName: string;
  type: AdminActionType;
  targetBusinessId?: string;
  targetBusinessName?: string;
  metadata?: Record<string, string | number | boolean>;
}

export async function writeAdminAction(input: WriteAdminActionInput): Promise<void> {
  const db = await getDb();
  const action: AdminAction = {
    id: crypto.randomUUID(),
    adminId: input.adminId,
    adminName: input.adminName,
    type: input.type,
    createdAt: new Date().toISOString(),
  };
  if (input.targetBusinessId) action.targetBusinessId = input.targetBusinessId;
  if (input.targetBusinessName) action.targetBusinessName = input.targetBusinessName;
  if (input.metadata) action.metadata = input.metadata;
  await db.collection<AdminAction>("adminActions").insertOne(action);
}

// ── Tenant list ─────────────────────────────────────────────────

export interface ListTenantsInput {
  page?: number;
  query?: string;
  // Subscription status filter — mirrors the client's "effective status"
  // logic (raw status field + expiry date).
  status?: "all" | "trial" | "active" | "expired" | "suspended";
  // Signup date window (based on createdAt).
  signupWindow?: "all" | "today" | "week" | "month" | "year";
  // Only tenants whose subscription expires within N days.
  expiringWithinDays?: number;
}

export interface ListTenantsResult {
  tenants: Business[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// Returns tenants without expensive per-tenant counts. The detail
// endpoint computes counts only for the tenant being viewed.
//
// Every filter clause is pushed into a top-level $and array so multiple
// $or conditions (search + expired) can coexist without one silently
// overwriting the other.
export async function listTenants(
  input: ListTenantsInput
): Promise<ListTenantsResult> {
  const db = await getDb();

  const andConditions: Record<string, unknown>[] = [];
  const now = new Date();

  // ── Search query ─────────────────────────────────────────────
  if (input.query && input.query.trim()) {
    const escaped = input.query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    andConditions.push({
      $or: [
        { name: { $regex: escaped, $options: "i" } },
        { ownerName: { $regex: escaped, $options: "i" } },
        { phone: { $regex: escaped, $options: "i" } },
      ],
    });
  }

  // ── Subscription status ──────────────────────────────────────
  // Filters must mirror the client's "effective status" logic, which
  // combines the raw status field with the expiry date. A tenant whose
  // status field still reads "trial" but whose trial has ended is
  // functionally expired and should NOT appear under the "Trial" filter.
  if (input.status && input.status !== "all") {
    if (input.status === "expired") {
      andConditions.push({
        $or: [
          { "subscription.status": "expired" },
          {
            "subscription.expiresAt": { $lt: now.toISOString() },
            "subscription.status": { $ne: "suspended" },
          },
        ],
      });
    } else if (input.status === "trial" || input.status === "active") {
      andConditions.push({
        "subscription.status": input.status,
        "subscription.expiresAt": { $gt: now.toISOString() },
      });
    } else {
      // suspended
      andConditions.push({ "subscription.status": input.status });
    }
  }

  // ── Signup window ────────────────────────────────────────────
  if (input.signupWindow && input.signupWindow !== "all") {
    const nowMs = now.getTime();
    let cutoffMs: number | null = null;
    if (input.signupWindow === "today") {
      cutoffMs = nowMs - 24 * 60 * 60 * 1000;
    } else if (input.signupWindow === "week") {
      cutoffMs = nowMs - 7 * 24 * 60 * 60 * 1000;
    } else if (input.signupWindow === "month") {
      cutoffMs = nowMs - 30 * 24 * 60 * 60 * 1000;
    } else if (input.signupWindow === "year") {
      cutoffMs = nowMs - 365 * 24 * 60 * 60 * 1000;
    }

    if (cutoffMs !== null) {
      andConditions.push({
        createdAt: { $gte: new Date(cutoffMs).toISOString() },
      });
    }
  }

  // ── Expiring-soon ────────────────────────────────────────────
  if (input.expiringWithinDays !== undefined && input.expiringWithinDays > 0) {
    const upper = new Date(
      now.getTime() + input.expiringWithinDays * 24 * 60 * 60 * 1000
    );
    andConditions.push({
      "subscription.expiresAt": {
        $gte: now.toISOString(),
        $lte: upper.toISOString(),
      },
      "subscription.status": { $in: ["trial", "active"] },
    });
  }

  // Combine into final filter — only wrap in $and when conditions
  // exist, so an empty filter stays a plain collection scan (cheap
  // enough for the "no filters" landing view).
  const filter: Record<string, unknown> =
    andConditions.length > 0 ? { $and: andConditions } : {};

  const page = Math.max(1, Math.floor(input.page ?? 1));
  const skip = (page - 1) * ADMIN_PAGE_SIZE;
  const collection = db.collection<Business>("businesses");

  const [tenants, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(ADMIN_PAGE_SIZE)
      .toArray(),
    collection.countDocuments(filter),
  ]);

  return {
    tenants,
    page,
    pageSize: ADMIN_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
  };
}

// ── Tenant detail ───────────────────────────────────────────────

export interface TenantDetail {
  business: Business;
  owner: User | null;
  counts: {
    users: number;
    products: number;
    suppliers: number;
    purchases: number;
    customers: number;
    sales: number;
  };
}

export async function getTenantDetail(
  businessId: string
): Promise<TenantDetail | null> {
  const db = await getDb();
  const business = await db
    .collection<Business>("businesses")
    .findOne({ id: businessId });
  if (!business) return null;

  // Parallel counts. Each is an indexed count on businessId (see
  // lib/db-indexes.ts), so even at scale these are O(log n).
  const [owner, users, products, suppliers, purchases, customers, sales] =
    await Promise.all([
      db
        .collection<User>("users")
        .findOne({ businessId, role: "owner" }),
      db.collection<User>("users").countDocuments({ businessId }),
      db.collection<Product>("products").countDocuments({ businessId }),
      db.collection<Supplier>("suppliers").countDocuments({ businessId }),
      db.collection<Purchase>("purchases").countDocuments({ businessId }),
      db.collection<Customer>("customers").countDocuments({ businessId }),
      db.collection<Sale>("sales").countDocuments({ businessId }),
    ]);

  return {
    business,
    owner,
    counts: { users, products, suppliers, purchases, customers, sales },
  };
}

export async function getOwnerForTenant(
  businessId: string
): Promise<User | null> {
  const db = await getDb();
  return db
    .collection<User>("users")
    .findOne({ businessId, role: "owner", active: true });
}

// ── Tenant mutations ────────────────────────────────────────────

export async function suspendTenant(
  businessId: string,
  reason: string | undefined,
  adminId: string
): Promise<Business | null> {
  const db = await getDb();
  const now = new Date().toISOString();

  const existing = await db
    .collection<Business>("businesses")
    .findOne({ id: businessId });
  if (!existing) return null;

  // Build the update object piecewise. Two cases:
  //   1. Tenant already has a subscription → flip its status and mark
  //      suspendedAt; nothing else changes.
  //   2. Tenant has no subscription yet → seed a minimal suspended
  //      subscription so the state is coherent.
  const setFields: Record<string, unknown> = { suspendedAt: now };

  if (existing.subscription) {
    setFields["subscription.status"] = "suspended";
  } else {
    const seeded: BusinessSubscription = {
      status: "suspended",
      plan: "trial",
      startedAt: now,
      expiresAt: now,
      lastGrantedBy: adminId,
      lastGrantedAt: now,
    };
    setFields.subscription = seeded;
  }

  if (reason) {
    setFields.suspendedReason = reason;
  }

  // When no reason is provided, explicitly clear any previous one so a
  // suspend-after-suspend doesn't leave a stale message.
  const unsetFields = reason ? undefined : { suspendedReason: "" };

  const update: Record<string, unknown> = { $set: setFields };
  if (unsetFields) update.$unset = unsetFields;

  return db
    .collection<Business>("businesses")
    .findOneAndUpdate({ id: businessId }, update, {
      returnDocument: "after",
    });
}

export async function activateTenant(
  businessId: string,
  adminId: string
): Promise<Business | null> {
  const db = await getDb();
  const now = new Date().toISOString();

  const existing = await db
    .collection<Business>("businesses")
    .findOne({ id: businessId });
  if (!existing) return null;

  // If they have no subscription yet, grant a fresh 30-day trial.
  // Otherwise, reactivate the existing subscription in place.
  const nextSubscription: BusinessSubscription = existing.subscription
    ? {
        ...existing.subscription,
        status: "active",
        lastGrantedBy: adminId,
        lastGrantedAt: now,
      }
    : {
        status: "active",
        plan: "trial",
        startedAt: now,
        expiresAt: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
        lastGrantedBy: adminId,
        lastGrantedAt: now,
      };

  return db
    .collection<Business>("businesses")
    .findOneAndUpdate(
      { id: businessId },
      {
        $set: { subscription: nextSubscription },
        $unset: { suspendedAt: "", suspendedReason: "" },
      },
      { returnDocument: "after" }
    );
}

export interface GrantSubscriptionInput {
  businessId: string;
  months: number;
  plan: string;
  notes?: string;
  adminId: string;
}

export async function grantSubscription(
  input: GrantSubscriptionInput
): Promise<Business | null> {
  const db = await getDb();
  const existing = await db
    .collection<Business>("businesses")
    .findOne({ id: input.businessId });
  if (!existing) return null;

  const now = new Date();
  // Extend from whichever is later: today, or the current expiry (so a
  // mid-cycle grant doesn't cut off remaining days).
  const startFrom =
    existing.subscription?.expiresAt &&
    new Date(existing.subscription.expiresAt) > now
      ? new Date(existing.subscription.expiresAt)
      : now;

  const expiresAt = new Date(startFrom);
  expiresAt.setMonth(expiresAt.getMonth() + input.months);

  const subscription: BusinessSubscription = {
    status: "active",
    plan: input.plan,
    startedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    lastGrantedBy: input.adminId,
    lastGrantedAt: now.toISOString(),
  };
  if (input.notes) subscription.notes = input.notes;

  return db
    .collection<Business>("businesses")
    .findOneAndUpdate(
      { id: input.businessId },
      {
        $set: { subscription },
        $unset: { suspendedAt: "", suspendedReason: "" },
      },
      { returnDocument: "after" }
    );
}

export async function resetOwnerPassword(
  businessId: string,
  newPassword: string
): Promise<boolean> {
  const db = await getDb();
  const owner = await db
    .collection<User>("users")
    .findOne({ businessId, role: "owner" });
  if (!owner) return false;

  const passwordHash = await hashPassword(newPassword);
  const result = await db
    .collection<User>("users")
    .updateOne({ id: owner.id }, { $set: { passwordHash } });

  return result.modifiedCount === 1;
}

// ── Audit log: read ─────────────────────────────────────────────

export interface ListActionsResult {
  actions: AdminAction[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export async function listAdminActions(page?: number): Promise<ListActionsResult> {
  const db = await getDb();
  const currentPage = Math.max(1, Math.floor(page ?? 1));
  const skip = (currentPage - 1) * ADMIN_PAGE_SIZE;
  const collection = db.collection<AdminAction>("adminActions");

  const [actions, total] = await Promise.all([
    collection
      .find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(ADMIN_PAGE_SIZE)
      .toArray(),
    collection.countDocuments({}),
  ]);

  return {
    actions,
    page: currentPage,
    pageSize: ADMIN_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
  };
}

// ── Impersonation context ───────────────────────────────────────
//
// Fetches the business name for the impersonation banner. Called from
// the business dashboard layout when the marker cookie is present.
// Returns null if the marker points to a non-existent business (e.g.
// the tenant was deleted during impersonation) so the caller can safely
// skip the banner.

export async function getImpersonationContext(
  businessId: string
): Promise<{ businessName: string } | null> {
  const db = await getDb();
  const business = await db
    .collection<Business>("businesses")
    .findOne({ id: businessId }, { projection: { name: 1, id: 1 } });
  return business ? { businessName: business.name } : null;
}