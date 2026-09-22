// lib/profit-fund.ts
//
// Server-only Profit Fund logic.
//
// Allocation model
// ----------------
// Every sale snapshots the enabled tiers and their percentages at the
// moment of insert (see Sale.profitFundAllocations). Summaries are
// computed by summing those snapshots — never by walking rate history.
// This makes historical numbers immutable: changing a rate today has
// zero effect on yesterday's sale.
//
// The `profitFundTierRates` collection still exists, but only for the
// "Rates" audit view — it is not consulted during any calculation.

import { getDb } from "@/lib/db";
import { withTransaction } from "@/lib/mongo-transaction";
import type { ClientSession } from "mongodb";
import type {
  ProfitFundDisbursement,
  ProfitFundSummary,
  ProfitFundTier,
  ProfitFundTierRate,
  ProfitFundTierSnapshot,
  Sale,
  SaleProfitFundAllocation,
} from "@/types";

// ── Allocation snapshot helper ──────────────────────────────────

// Called from lib/sales.ts inside the sale transaction. Returns one
// entry per enabled tier active right now. Uses the tier's current
// percentage (which is itself a cache of the most recent rate row) —
// sales are always recorded for "today", so current === active.
export async function snapshotTierAllocations(
  session: ClientSession,
  businessId: string,
  profit: number
): Promise<SaleProfitFundAllocation[]> {
  const db = await getDb();
  const tiers = await db
    .collection<ProfitFundTier>("profitFundTiers")
    .find({ businessId, enabled: true }, { session })
    .toArray();

  return tiers.map((tier) => ({
    tierId: tier.id,
    tierName: tier.name,
    percentage: tier.percentage,
    amount: Math.round((profit * tier.percentage) / 100),
  }));
}

// ── Tier CRUD ───────────────────────────────────────────────────

export async function listTiers(
  businessId: string
): Promise<ProfitFundTier[]> {
  const db = await getDb();
  const tiers = await db
    .collection<ProfitFundTier>("profitFundTiers")
    .find({ businessId })
    .sort({ createdAt: 1 })
    .toArray();

  // Lazy backfill: any tier without rate history (legacy data) gets a
  // single rate derived from its current percentage + createdAt. Only
  // affects the audit view.
  await Promise.all(tiers.map(ensureTierHasRate));
  return tiers;
}

async function ensureTierHasRate(tier: ProfitFundTier): Promise<void> {
  const db = await getDb();
  const existing = await db
    .collection<ProfitFundTierRate>("profitFundTierRates")
    .findOne(
      { businessId: tier.businessId, tierId: tier.id },
      { projection: { id: 1 } }
    );
  if (existing) return;

  const now = new Date().toISOString();
  const rate: ProfitFundTierRate = {
    id: crypto.randomUUID(),
    businessId: tier.businessId,
    tierId: tier.id,
    percentage: tier.percentage,
    effectiveFrom: tier.createdAt,
    createdAt: now,
  };
  await db
    .collection<ProfitFundTierRate>("profitFundTierRates")
    .insertOne(rate);
}

export async function getTierById(
  businessId: string,
  tierId: string
): Promise<ProfitFundTier | null> {
  const db = await getDb();
  const tier = await db
    .collection<ProfitFundTier>("profitFundTiers")
    .findOne({ id: tierId, businessId });
  if (tier) await ensureTierHasRate(tier);
  return tier;
}

export async function isTierNameTaken(
  businessId: string,
  name: string,
  excludeId?: string
): Promise<boolean> {
  const db = await getDb();
  const filter: Record<string, unknown> = { businessId, name };
  if (excludeId) filter.id = { $ne: excludeId };
  const existing = await db
    .collection<ProfitFundTier>("profitFundTiers")
    .findOne(filter, { projection: { id: 1 } });
  return existing !== null;
}

export async function insertTierWithInitialRate(
  businessId: string,
  name: string,
  percentage: number,
  enabled: boolean
): Promise<ProfitFundTier> {
  const db = await getDb();
  const now = new Date().toISOString();
  const tierId = crypto.randomUUID();

  return withTransaction(async (session) => {
    const tier: ProfitFundTier = {
      id: tierId,
      businessId,
      name,
      percentage,
      enabled,
      createdAt: now,
    };

    const rate: ProfitFundTierRate = {
      id: crypto.randomUUID(),
      businessId,
      tierId,
      percentage,
      effectiveFrom: now,
      createdAt: now,
    };

    await db
      .collection<ProfitFundTier>("profitFundTiers")
      .insertOne(tier, { session });
    await db
      .collection<ProfitFundTierRate>("profitFundTierRates")
      .insertOne(rate, { session });

    return tier;
  });
}

export interface UpdateTierInput {
  name?: string;
  percentage?: number;
  enabled?: boolean;
}

export async function updateTierWithRate(
  businessId: string,
  tierId: string,
  updates: UpdateTierInput
): Promise<ProfitFundTier | null> {
  const db = await getDb();
  const now = new Date().toISOString();

  return withTransaction(async (session) => {
    const tier = await db
      .collection<ProfitFundTier>("profitFundTiers")
      .findOne({ id: tierId, businessId }, { session });
    if (!tier) return null;

    const setFields: Record<string, unknown> = {};
    if (updates.name !== undefined) setFields.name = updates.name;
    if (updates.enabled !== undefined) setFields.enabled = updates.enabled;

    let rateChanged = false;
    if (
      updates.percentage !== undefined &&
      updates.percentage !== tier.percentage
    ) {
      setFields.percentage = updates.percentage;
      rateChanged = true;
    }

    if (Object.keys(setFields).length === 0) return tier;

    if (rateChanged) {
      const rate: ProfitFundTierRate = {
        id: crypto.randomUUID(),
        businessId,
        tierId,
        percentage: updates.percentage as number,
        effectiveFrom: now,
        createdAt: now,
      };
      await db
        .collection<ProfitFundTierRate>("profitFundTierRates")
        .insertOne(rate, { session });
    }

    const updated = await db
      .collection<ProfitFundTier>("profitFundTiers")
      .findOneAndUpdate(
        { id: tierId, businessId },
        { $set: setFields },
        { returnDocument: "after", session }
      );

    return updated;
  });
}

export async function tierHasDisbursements(
  businessId: string,
  tierId: string
): Promise<boolean> {
  const db = await getDb();
  const existing = await db
    .collection<ProfitFundDisbursement>("profitFundDisbursements")
    .findOne({ businessId, tierId }, { projection: { id: 1 } });
  return existing !== null;
}

// Cascades rate history cleanup + tier delete inside a single
// transaction — a partial failure can no longer orphan rate rows.
export async function deleteTier(
  businessId: string,
  tierId: string
): Promise<boolean> {
  const db = await getDb();
  return withTransaction(async (session) => {
    await db
      .collection<ProfitFundTierRate>("profitFundTierRates")
      .deleteMany({ businessId, tierId }, { session });

    const result = await db
      .collection<ProfitFundTier>("profitFundTiers")
      .deleteOne({ id: tierId, businessId }, { session });

    return result.deletedCount === 1;
  });
}

// ── Rate history (audit view only) ──────────────────────────────

export async function listTierRates(
  businessId: string,
  tierId: string
): Promise<ProfitFundTierRate[]> {
  const db = await getDb();
  return db
    .collection<ProfitFundTierRate>("profitFundTierRates")
    .find({ businessId, tierId })
    .sort({ effectiveFrom: 1 })
    .toArray();
}

// ── Disbursements ───────────────────────────────────────────────

export async function listDisbursementsForTier(
  businessId: string,
  tierId: string
): Promise<ProfitFundDisbursement[]> {
  const db = await getDb();
  return db
    .collection<ProfitFundDisbursement>("profitFundDisbursements")
    .find({ businessId, tierId })
    .sort({ date: -1, createdAt: -1 })
    .toArray();
}

export async function insertDisbursement(
  disbursement: ProfitFundDisbursement
): Promise<void> {
  const db = await getDb();
  await db
    .collection<ProfitFundDisbursement>("profitFundDisbursements")
    .insertOne(disbursement);
}

async function sumDisbursementsByTier(
  businessId: string
): Promise<Map<string, number>> {
  const db = await getDb();
  const rows = await db
    .collection<ProfitFundDisbursement>("profitFundDisbursements")
    .aggregate<{ _id: string; total: number }>([
      { $match: { businessId } },
      { $group: { _id: "$tierId", total: { $sum: "$amount" } } },
    ])
    .toArray();

  const map = new Map<string, number>();
  for (const row of rows) map.set(row._id, row.total);
  return map;
}

// ── Snapshot-based aggregation ──────────────────────────────────

// Sums the tier's frozen allocations across every sale in the list.
// Sales without a `profitFundAllocations` array (created before the
// snapshot feature) contribute zero.
function sumSnapshotsForTier(sales: Sale[], tierId: string): number {
  let total = 0;
  for (const sale of sales) {
    if (!sale.profitFundAllocations) continue;
    for (const alloc of sale.profitFundAllocations) {
      if (alloc.tierId === tierId) total += alloc.amount;
    }
  }
  return total;
}

// ── Summary (page-facing) ───────────────────────────────────────

export async function getProfitFundSummary(
  businessId: string,
  range: { from: string; to: string; preset: string }
): Promise<ProfitFundSummary> {
  const db = await getDb();

  const [tiers, rangeSales, lifetimeSales, disbursedByTier] = await Promise.all([
    listTiers(businessId),
    db
      .collection<Sale>("sales")
      .find(
        { businessId, date: { $gte: range.from, $lte: range.to } },
        {
          projection: {
            _id: 0,
            date: 1,
            profit: 1,
            profitFundAllocations: 1,
          },
        }
      )
      .toArray(),
    db
      .collection<Sale>("sales")
      .find(
        { businessId },
        {
          projection: {
            _id: 0,
            date: 1,
            profit: 1,
            profitFundAllocations: 1,
          },
        }
      )
      .toArray(),
    sumDisbursementsByTier(businessId),
  ]);

  const rangeProfit = rangeSales.reduce((sum, s) => sum + s.profit, 0);
  const lifetimeProfit = lifetimeSales.reduce((sum, s) => sum + s.profit, 0);

  const tierSnapshots: ProfitFundTierSnapshot[] = tiers.map((tier) => {
    const rangeAllocation = sumSnapshotsForTier(rangeSales, tier.id);
    const lifetimeAllocation = sumSnapshotsForTier(lifetimeSales, tier.id);
    const lifetimeDisbursed = disbursedByTier.get(tier.id) ?? 0;

    return {
      ...tier,
      rangeAllocation,
      lifetimeAllocation,
      lifetimeDisbursed,
      availableBalance: lifetimeAllocation - lifetimeDisbursed,
    };
  });

  return {
    range: range as ProfitFundSummary["range"],
    rangeProfit,
    lifetimeProfit,
    tiers: tierSnapshots,
    totalRangeAllocation: tierSnapshots.reduce(
      (sum, t) => sum + t.rangeAllocation,
      0
    ),
    totalLifetimeDisbursed: tierSnapshots.reduce(
      (sum, t) => sum + t.lifetimeDisbursed,
      0
    ),
    totalAvailableBalance: tierSnapshots.reduce(
      (sum, t) => sum + t.availableBalance,
      0
    ),
  };
}

// ── Disbursement recording ──────────────────────────────────────

export type RecordDisbursementErrorCode =
  | "TIER_NOT_FOUND"
  | "TIER_DISABLED"
  | "INVALID_AMOUNT"
  | "INSUFFICIENT_BALANCE";

export interface RecordDisbursementResult {
  success: boolean;
  code?: RecordDisbursementErrorCode;
  disbursement?: ProfitFundDisbursement;
  available?: number;
}

export async function recordDisbursement(input: {
  businessId: string;
  tierId: string;
  amount: number;
  date: string;
  note?: string;
}): Promise<RecordDisbursementResult> {
  const { businessId, tierId, amount, date, note } = input;

  const tier = await getTierById(businessId, tierId);
  if (!tier) return { success: false, code: "TIER_NOT_FOUND" };
  if (!tier.enabled) return { success: false, code: "TIER_DISABLED" };
  if (amount <= 0) return { success: false, code: "INVALID_AMOUNT" };

  const db = await getDb();

  const [lifetimeSales, disbursedByTier] = await Promise.all([
    db
      .collection<Sale>("sales")
      .find({ businessId }, { projection: { _id: 0, profitFundAllocations: 1 } })
      .toArray(),
    sumDisbursementsByTier(businessId),
  ]);

  const lifetimeAllocation = sumSnapshotsForTier(lifetimeSales, tierId);
  const alreadyDisbursed = disbursedByTier.get(tierId) ?? 0;
  const available = lifetimeAllocation - alreadyDisbursed;

  if (amount > available) {
    return {
      success: false,
      code: "INSUFFICIENT_BALANCE",
      available,
    };
  }

  const now = new Date().toISOString();
  const disbursement: ProfitFundDisbursement = {
    id: crypto.randomUUID(),
    businessId,
    tierId,
    amount,
    date,
    createdAt: now,
  };
  if (note) disbursement.note = note;

  await insertDisbursement(disbursement);

  return { success: true, disbursement };
}