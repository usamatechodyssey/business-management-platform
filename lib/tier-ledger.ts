// lib/tier-ledger.ts
//
// Builds a period-by-period ledger for a single Profit Fund tier.
//
// A "period" is the window between two consecutive rate changes. For
// each period we compute:
//   • the total profit earned in that window (all sales — informational)
//   • the allocation recorded for THIS tier via sale snapshots (the
//     authoritative number — a sale only contributes if it was made
//     while this tier was enabled)
//   • the disbursements recorded in that window
//   • a running available balance
//
// Why snapshots and not "percentage × profit": when a tier is disabled,
// new sales carry no snapshot for it. Recalculating from the current
// rate would incorrectly attribute profit that was never allocated.
// Snapshots are the source of truth — the same source the main Profit
// Fund page reads.

import { getDb } from "@/lib/db";
import { listTierRates } from "@/lib/profit-fund";
import type {
  ProfitFundDisbursement,
  ProfitFundTier,
  Sale,
  SaleProfitFundAllocation,
} from "@/types";

export interface TierLedgerPeriod {
  from: string;      // ISO timestamp (inclusive)
  to: string | null; // ISO timestamp (exclusive); null = current
  percentage: number;
  profitInPeriod: number;
  allocatedInPeriod: number;
  disbursedInPeriod: number;
  runningBalance: number;
}

export interface TierLedgerReport {
  tier: ProfitFundTier;
  generatedAt: string;
  periods: TierLedgerPeriod[];
  totals: {
    totalProfit: number;
    totalAllocated: number;
    totalDisbursed: number;
    availableBalance: number;
  };
}

function buildWindows(
  rates: { effectiveFrom: string; percentage: number }[],
  rangeFrom: string,
  rangeTo: string
): { from: string; to: string | null; percentage: number }[] {
  if (rates.length === 0) return [];

  const windows: { from: string; to: string | null; percentage: number }[] = [];
  const rangeStartIso = `${rangeFrom}T00:00:00.000Z`;
  const rangeEndIso = `${rangeTo}T23:59:59.999Z`;

  for (let i = 0; i < rates.length; i++) {
    const current = rates[i]!;
    const next = rates[i + 1];

    const windowStart =
      current.effectiveFrom < rangeStartIso
        ? rangeStartIso
        : current.effectiveFrom;
    const windowEnd = next ? next.effectiveFrom : null;

    if (windowEnd !== null && windowEnd < rangeStartIso) continue;
    if (windowStart > rangeEndIso) continue;

    windows.push({
      from: windowStart,
      to: windowEnd,
      percentage: current.percentage,
    });
  }

  return windows;
}

// Extracts this tier's frozen allocation from a sale, or 0 if the sale
// was made while the tier was disabled (or before it existed).
function snapshotAmountForTier(
  sale: Sale,
  tierId: string
): number {
  const allocations: SaleProfitFundAllocation[] | undefined =
    sale.profitFundAllocations;
  if (!allocations) return 0;
  const match = allocations.find((a) => a.tierId === tierId);
  return match?.amount ?? 0;
}

export async function buildTierLedger(
  businessId: string,
  tier: ProfitFundTier,
  rangeFrom: string,
  rangeTo: string
): Promise<TierLedgerReport> {
  const db = await getDb();

  const [rates, sales, disbursements] = await Promise.all([
    listTierRates(businessId, tier.id),
    db
      .collection<Sale>("sales")
      .find(
        { businessId, date: { $gte: rangeFrom, $lte: rangeTo } },
        {
          projection: {
            _id: 0,
            date: 1,
            profit: 1,
            createdAt: 1,
            profitFundAllocations: 1,
          },
        }
      )
      .toArray(),
    db
      .collection<ProfitFundDisbursement>("profitFundDisbursements")
      .find(
        {
          businessId,
          tierId: tier.id,
          date: { $gte: rangeFrom, $lte: rangeTo },
        },
        { projection: { _id: 0, date: 1, amount: 1, createdAt: 1 } }
      )
      .toArray(),
  ]);

  const windows = buildWindows(rates, rangeFrom, rangeTo);

  let runningAllocated = 0;
  let runningDisbursed = 0;

  const periods: TierLedgerPeriod[] = windows.map((w) => {
    const from = w.from;
    const to = w.to;

    const salesInWindow = sales.filter((s) => {
      if (s.createdAt < from) return false;
      if (to !== null && s.createdAt >= to) return false;
      return true;
    });

    const disbursementsInWindow = disbursements.filter((d) => {
      if (d.createdAt < from) return false;
      if (to !== null && d.createdAt >= to) return false;
      return true;
    });

    // Profit — informational, includes every sale in the window.
    const profitInPeriod = salesInWindow.reduce((sum, s) => sum + s.profit, 0);

    // Allocation — the authoritative source is the sale snapshot. A
    // sale made while the tier was disabled contributes 0.
    const allocatedInPeriod = salesInWindow.reduce(
      (sum, s) => sum + snapshotAmountForTier(s, tier.id),
      0
    );

    const disbursedInPeriod = disbursementsInWindow.reduce(
      (sum, d) => sum + d.amount,
      0
    );

    runningAllocated += allocatedInPeriod;
    runningDisbursed += disbursedInPeriod;

    return {
      from,
      to,
      percentage: w.percentage,
      profitInPeriod,
      allocatedInPeriod,
      disbursedInPeriod,
      runningBalance: runningAllocated - runningDisbursed,
    };
  });

  const totalProfit = periods.reduce((s, p) => s + p.profitInPeriod, 0);
  const totalAllocated = periods.reduce((s, p) => s + p.allocatedInPeriod, 0);
  const totalDisbursed = periods.reduce((s, p) => s + p.disbursedInPeriod, 0);

  return {
    tier,
    generatedAt: new Date().toISOString(),
    periods,
    totals: {
      totalProfit,
      totalAllocated,
      totalDisbursed,
      availableBalance: totalAllocated - totalDisbursed,
    },
  };
}