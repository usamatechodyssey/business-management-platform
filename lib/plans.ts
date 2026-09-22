// lib/plans.ts
//
// Admin-managed subscription plan tiers. Replaces the hardcoded
// pricing table in lib/pricing.ts. Everything here is DB-backed so
// admins can rename plans, change prices, edit limits, and reorder
// tiers without a code change.
//
// Plans are seeded on first access via ensureDefaultPlans() — safe to
// call on every page load, it's a no-op once data exists.

import { getDb } from "@/lib/db";
import { UNLIMITED, type PlanLimits, type PlanTier } from "@/types";



const DEFAULT_PLANS: Omit<PlanTier, "id" | "createdAt" | "updatedAt">[] = [
  {
    slug: "trial",
    name: "Trial",
    priceMonthly: 0,
    description: "14-day trial with full features.",
    features: [
      "Full feature access",
      "Up to 100 products",
      "2 staff members",
      "No credit card required",
    ],
    limits: {
      users: 2,
      products: 100,
      customers: 100,
      suppliers: 20,
      salesPerMonth: 100,
    },
    displayOrder: 0,
    active: true,
    isTrialPlan: true,
  },
  {
    slug: "basic",
    name: "Basic",
    priceMonthly: 1500,
    description: "For small shops getting started.",
    features: [
      "All core modules",
      "Up to 500 products",
      "3 staff members",
      "WhatsApp reminders",
    ],
    limits: {
      users: 3,
      products: 500,
      customers: 500,
      suppliers: 100,
      salesPerMonth: 1000,
    },
    displayOrder: 1,
    active: true,
    isTrialPlan: false,
  },
  {
    slug: "pro",
    name: "Pro",
    priceMonthly: 3000,
    description: "For growing businesses.",
    features: [
      "Everything in Basic",
      "Up to 2,000 products",
      "5 staff members",
      "Priority support",
    ],
    limits: {
      users: 5,
      products: 2000,
      customers: 2000,
      suppliers: 500,
      salesPerMonth: 10000,
    },
    displayOrder: 2,
    active: true,
    isTrialPlan: false,
  },
  {
    slug: "business",
    name: "Business",
    priceMonthly: 6000,
    description: "For established operations.",
    features: [
      "Everything in Pro",
      "Unlimited products",
      "Unlimited staff",
      "Unlimited customers",
    ],
    limits: {
      users: UNLIMITED,
      products: UNLIMITED,
      customers: UNLIMITED,
      suppliers: UNLIMITED,
      salesPerMonth: UNLIMITED,
    },
    displayOrder: 3,
    active: true,
    isTrialPlan: false,
  },
];

// Idempotent — inserts default plans only when the collection is empty.
// Called from the admin plans page and the business billing page so
// whichever loads first seeds the set.
export async function ensureDefaultPlans(): Promise<void> {
  const db = await getDb();
  const collection = db.collection<PlanTier>("planTiers");
  const existing = await collection.countDocuments({});
  if (existing > 0) return;

  const now = new Date().toISOString();
  const docs: PlanTier[] = DEFAULT_PLANS.map((p) => ({
    ...p,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  }));

  await collection.insertMany(docs);
}

// Returns all plans (active and inactive), ordered for admin display.
export async function listAllPlans(): Promise<PlanTier[]> {
  await ensureDefaultPlans();
  const db = await getDb();
  return db
    .collection<PlanTier>("planTiers")
    .find({})
    .sort({ displayOrder: 1, priceMonthly: 1 })
    .toArray();
}

// Returns only active plans for customer-facing pages.
export async function listActivePlans(): Promise<PlanTier[]> {
  await ensureDefaultPlans();
  const db = await getDb();
  return db
    .collection<PlanTier>("planTiers")
    .find({ active: true })
    .sort({ displayOrder: 1, priceMonthly: 1 })
    .toArray();
}

export async function getPlanBySlug(slug: string): Promise<PlanTier | null> {
  const db = await getDb();
  return db.collection<PlanTier>("planTiers").findOne({ slug });
}

export async function getPlanById(id: string): Promise<PlanTier | null> {
  const db = await getDb();
  return db.collection<PlanTier>("planTiers").findOne({ id });
}

export async function isPlanSlugTaken(
  slug: string,
  excludeId?: string
): Promise<boolean> {
  const db = await getDb();
  const filter: Record<string, unknown> = { slug };
  if (excludeId) filter.id = { $ne: excludeId };
  const existing = await db
    .collection<PlanTier>("planTiers")
    .findOne(filter, { projection: { id: 1 } });
  return existing !== null;
}

export interface CreatePlanInput {
  slug: string;
  name: string;
  priceMonthly: number;
  description?: string;
  features: string[];
  limits: PlanLimits;
  displayOrder: number;
  active: boolean;
}

export async function insertPlan(input: CreatePlanInput): Promise<PlanTier> {
  const db = await getDb();
  const now = new Date().toISOString();
  const plan: PlanTier = {
    id: crypto.randomUUID(),
    slug: input.slug,
    name: input.name,
    priceMonthly: input.priceMonthly,
    features: input.features,
    limits: input.limits,
    displayOrder: input.displayOrder,
    active: input.active,
    isTrialPlan: false,
    createdAt: now,
    updatedAt: now,
  };
  if (input.description) plan.description = input.description;

  await db.collection<PlanTier>("planTiers").insertOne(plan);
  return plan;
}

export async function updatePlanFields(
  planId: string,
  updates: Partial<Omit<PlanTier, "id" | "createdAt" | "isTrialPlan">>
): Promise<PlanTier | null> {
  const db = await getDb();
  return db.collection<PlanTier>("planTiers").findOneAndUpdate(
    { id: planId },
    { $set: { ...updates, updatedAt: new Date().toISOString() } },
    { returnDocument: "after" }
  );
}

// Counts businesses currently on a given plan slug. Used to refuse
// deleting a plan that is in use.
export async function countBusinessesOnPlan(slug: string): Promise<number> {
  const db = await getDb();
  return db
    .collection("businesses")
    .countDocuments({ "subscription.plan": slug });
}

export async function deletePlanById(planId: string): Promise<boolean> {
  const db = await getDb();
  const result = await db
    .collection<PlanTier>("planTiers")
    .deleteOne({ id: planId });
  return result.deletedCount === 1;
}
// Re-export for existing server-side consumers (lib/limits.ts). Client
// components MUST import UNLIMITED from @/types directly to avoid
// pulling the MongoDB driver into the browser bundle.
export { UNLIMITED };