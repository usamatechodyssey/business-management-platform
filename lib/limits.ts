// lib/limits.ts
//
// Resource-level usage counters and plan-limit checks. Called from every
// API route that creates a resource counted against a plan's quota.
//
// A limit of -1 (UNLIMITED) means no cap. A business without a
// subscription is treated as unlimited (grandfathered).

import { getDb } from "@/lib/db";
import { getPlanBySlug, UNLIMITED } from "@/lib/plans";
import type { Business, PlanLimits } from "@/types";

export type ResourceType = keyof PlanLimits;

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
}

// YYYY-MM-DD bounds for the current calendar month in PKT.
function currentMonthPKT(): { from: string; to: string } {
  const shifted = new Date(Date.now() + 5 * 60 * 60 * 1000);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const mm = String(month + 1).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

// Counts how many of a resource the tenant currently has. Only active
// products/users are counted (archived ones don't count against quota).
export async function getResourceCount(
  businessId: string,
  resource: ResourceType
): Promise<number> {
  const db = await getDb();

  switch (resource) {
    case "users":
      return db
        .collection("users")
        .countDocuments({ businessId, active: true });
    case "products":
      return db
        .collection("products")
        .countDocuments({ businessId, active: true });
    case "customers":
      return db.collection("customers").countDocuments({ businessId });
    case "suppliers":
      return db.collection("suppliers").countDocuments({ businessId });
    case "salesPerMonth": {
      const { from, to } = currentMonthPKT();
      return db
        .collection("sales")
        .countDocuments({ businessId, date: { $gte: from, $lte: to } });
    }
  }
}

export async function getBusinessLimit(
  businessId: string,
  resource: ResourceType
): Promise<number> {
  const db = await getDb();
  const business = await db
    .collection<Business>("businesses")
    .findOne({ id: businessId }, { projection: { subscription: 1 } });

  if (!business?.subscription) return UNLIMITED;

  const plan = await getPlanBySlug(business.subscription.plan);
  if (!plan) return UNLIMITED;

  return plan.limits[resource];
}

export async function checkResourceLimit(
  businessId: string,
  resource: ResourceType
): Promise<LimitCheckResult> {
  const [current, limit] = await Promise.all([
    getResourceCount(businessId, resource),
    getBusinessLimit(businessId, resource),
  ]);

  const allowed = limit === UNLIMITED || current < limit;
  return { allowed, current, limit };
}