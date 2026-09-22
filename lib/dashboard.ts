// lib/dashboard.ts
//
// Server-only dashboard logic. Resolves the requested time range (in
// Pakistan Standard Time) and computes the summary metrics via MongoDB
// aggregation pipelines. Types live in types/index.ts so client
// components can import them without pulling this module (and its DB
// dependency) into their bundle.

import { getDb } from "@/lib/db";
import type {
  Business,
  Customer,
  DashboardRange,
  DashboardSummary,
  Product,
  RangePreset,
  Sale,
  TopItem,
} from "@/types";

const TOP_ITEMS_LIMIT = 5;

// Pakistan Standard Time is UTC+5 year-round (no DST). "Calendar day in
// Pakistan" boundaries are computed by shifting now() to PKT, reading the
// calendar date, then shifting back to UTC for the actual epoch bounds.
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

function nowInPakistan(): { year: number; month: number; date: number } {
  const shifted = new Date(Date.now() + PKT_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    date: shifted.getUTCDate(),
  };
}

// [startMs, endMs] in UTC epoch ms, where the boundaries represent
// 00:00:00.000 PKT and 23:59:59.999 PKT on the given PKT calendar date.
function pktDayBounds(year: number, month: number, date: number): [number, number] {
  const startUtc = Date.UTC(year, month, date, 0, 0, 0, 0) - PKT_OFFSET_MS;
  const endUtc = Date.UTC(year, month, date, 23, 59, 59, 999) - PKT_OFFSET_MS;
  return [startUtc, endUtc];
}

// Parses "YYYY-MM-DD" into {year, month, date} where month is 0-based.
// Returns null for malformed input.
function parseIsoDateOnly(
  value: string | undefined
): { year: number; month: number; date: number } | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const date = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(date)) {
    return null;
  }
  if (month < 0 || month > 11 || date < 1 || date > 31) return null;
  return { year, month, date };
}
const VALID_PRESETS: RangePreset[] = [
  "today",
  "week",
  "month",
  "quarter",
  "halfYear",
  "year",
  "custom",
];

export function resolveRange(
  preset: string | undefined,
  customFrom?: string | undefined,
  customTo?: string | undefined
): DashboardRange {
  const safePreset: RangePreset = VALID_PRESETS.includes(preset as RangePreset)
    ? (preset as RangePreset)
    : "month";

  if (safePreset === "custom") {
    const fromDate = parseIsoDateOnly(customFrom);
    const toDate = parseIsoDateOnly(customTo);
    if (fromDate && toDate) {
      const [fromMs] = pktDayBounds(fromDate.year, fromDate.month, fromDate.date);
      const [, toMs] = pktDayBounds(toDate.year, toDate.month, toDate.date);
      if (fromMs <= toMs) {
        return {
          preset: "custom",
          from: new Date(fromMs).toISOString(),
          to: new Date(toMs).toISOString(),
        };
      }
    }
    // Malformed custom range → fall through to the default (this month).
  }

  const { year, month, date } = nowInPakistan();
  let fromMs: number;
  let toMs: number;

  if (safePreset === "today") {
    [fromMs, toMs] = pktDayBounds(year, month, date);
  } else if (safePreset === "week") {
    // Last 7 days inclusive of today.
    [fromMs] = pktDayBounds(year, month, date - 6);
    [, toMs] = pktDayBounds(year, month, date);
  } else if (safePreset === "quarter") {
    // Last 3 months inclusive of the current month.
    // Start = 1st of the month 2 months back (e.g. today in May → Mar 1).
    // End   = last day of the current month.
    [fromMs] = pktDayBounds(year, month - 2, 1);
    [, toMs] = pktDayBounds(year, month + 1, 0);
  } else if (safePreset === "halfYear") {
    // Last 6 months inclusive of the current month.
    // Start = 1st of the month 5 months back (e.g. today in Jun → Jan 1).
    [fromMs] = pktDayBounds(year, month - 5, 1);
    [, toMs] = pktDayBounds(year, month + 1, 0);
  } else if (safePreset === "year") {
    [fromMs] = pktDayBounds(year, 0, 1);
    [, toMs] = pktDayBounds(year, 11, 31);
  } else {
    // "month" (also the fallback for malformed custom).
    [fromMs] = pktDayBounds(year, month, 1);
    // Day 0 of next month = last day of current month.
    [, toMs] = pktDayBounds(year, month + 1, 0);
  }

  return {
    preset: safePreset,
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
  };
}

export async function getDashboardSummary(
  businessId: string,
  range: DashboardRange
): Promise<DashboardSummary> {
  const db = await getDb();

  // ── Range-bound: sales total, profit total, sales count ─────────
  const salesAgg = await db
    .collection<Sale>("sales")
    .aggregate<{
      _id: null;
      totalSales: number;
      totalProfit: number;
      count: number;
    }>([
      {
        $match: {
          businessId,
          date: { $gte: range.from, $lte: range.to },
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$total" },
          totalProfit: { $sum: "$profit" },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const salesRow = salesAgg[0];
  const totalSales = salesRow?.totalSales ?? 0;
  const totalProfit = salesRow?.totalProfit ?? 0;
  const salesCount = salesRow?.count ?? 0;

  // ── Top items: unwind sale.items, group by product ──────────────
  const topItemsAgg = await db
    .collection<Sale>("sales")
    .aggregate<{
      _id: string;
      productName: string;
      qtySold: number;
      revenue: number;
    }>([
      {
        $match: {
          businessId,
          date: { $gte: range.from, $lte: range.to },
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          productName: { $first: "$items.productName" },
          qtySold: { $sum: "$items.qty" },
          revenue: { $sum: { $multiply: ["$items.qty", "$items.price"] } },
        },
      },
      { $sort: { qtySold: -1, revenue: -1 } },
      { $limit: TOP_ITEMS_LIMIT },
    ])
    .toArray();

  const topItems: TopItem[] = topItemsAgg.map((row) => ({
    productId: row._id,
    productName: row.productName,
    qtySold: row.qtySold,
    revenue: row.revenue,
  }));

  // ── Snapshot metrics (not range-bound) ──────────────────────────
  //
  // Single source of truth for receivables is Customer.totalDue — this
  // is the same value the Customers page shows, so the two screens can
  // never disagree. Summing Sale.amountDue would drift the moment a
  // partial payment is recorded against an older invoice.

  const receivablesAgg = await db
    .collection<Customer>("customers")
    .aggregate<{ _id: null; total: number; count: number }>([
      { $match: { businessId } },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalDue" },
          count: { $sum: { $cond: [{ $gt: ["$totalDue", 0] }, 1, 0] } },
        },
      },
    ])
    .toArray();

  const receivablesRow = receivablesAgg[0];
  const totalReceivables = receivablesRow?.total ?? 0;
  const customersWithDue = receivablesRow?.count ?? 0;

  // Low stock: product.lowStockThreshold ?? business.settings.lowStockThreshold.
  // Business is fetched once so we don't hit the DB per product.
  const business = await db
    .collection<Business>("businesses")
    .findOne({ id: businessId });

  const globalThreshold = business?.settings.lowStockThreshold ?? 0;

  const lowStockCount = await db
    .collection<Product>("products")
    .countDocuments({
      businessId,
      $expr: {
        $lt: [
          "$stockQty",
          { $ifNull: ["$lowStockThreshold", globalThreshold] },
        ],
      },
    });

  const productsCount = await db
    .collection<Product>("products")
    .countDocuments({ businessId });

  return {
    range,
    metrics: {
      totalSales,
      totalProfit,
      salesCount,
      totalReceivables,
      customersWithDue,
      lowStockCount,
      productsCount,
    },
    topItems,
  };
}