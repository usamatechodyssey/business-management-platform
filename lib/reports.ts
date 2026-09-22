// lib/reports.ts
//
// Server-only report aggregation. Assembles:
//   - core metrics (sales, profit, count)
//   - profit-fund breakdown (reuses lib/profit-fund's summary)
//   - top items by revenue
//   - top customers by revenue
//   - trend points for the bar chart (auto-bucketed by day or month)
//
// Bucket rule for the trend: if the range spans <= 31 days, bucket by
// day ("YYYY-MM-DD"); otherwise bucket by month ("YYYY-MM"). This keeps
// the bar count manageable on wide ranges without client-side
// aggregation.

import { getDb } from "@/lib/db";
import { getProfitFundSummary } from "@/lib/profit-fund";
import type {
  DashboardRange,
  ProfitFundBreakdownLine,
  ReportSummary,
  Sale,
  TopCustomer,
  TopItem,
  TrendPoint,
} from "@/types";

const TOP_ITEMS_LIMIT = 10;
const TOP_CUSTOMERS_LIMIT = 10;
const DAY_BUCKET_MAX_DAYS = 31;

export async function getReportSummary(
  businessId: string,
  range: DashboardRange
): Promise<ReportSummary> {
  const db = await getDb();
  const sales = db.collection<Sale>("sales");
  const dateMatch = { $gte: range.from, $lte: range.to };

  const [coreAgg, topItemsAgg, topCustomersAgg, trend, fundSummary] =
    await Promise.all([
      // Core metrics: totals across the range.
      sales
        .aggregate<{
          _id: null;
          totalSales: number;
          totalProfit: number;
          count: number;
        }>([
          { $match: { businessId, date: dateMatch } },
          {
            $group: {
              _id: null,
              totalSales: { $sum: "$total" },
              totalProfit: { $sum: "$profit" },
              count: { $sum: 1 },
            },
          },
        ])
        .toArray(),

      // Top items by revenue. Profit per item is derived from the cost
      // snapshot stored at sale time — no runtime product lookup needed.
      sales
        .aggregate<{
          _id: string;
          productName: string;
          qtySold: number;
          revenue: number;
        }>([
          { $match: { businessId, date: dateMatch } },
          { $unwind: "$items" },
          {
            $group: {
              _id: "$items.productId",
              productName: { $first: "$items.productName" },
              qtySold: { $sum: "$items.qty" },
              revenue: {
                $sum: { $multiply: ["$items.qty", "$items.price"] },
              },
            },
          },
          { $sort: { revenue: -1 } },
          { $limit: TOP_ITEMS_LIMIT },
        ])
        .toArray(),

      // Top customers — walk-in sales (no customerId) are excluded
      // because there's no name to attribute them to.
      sales
        .aggregate<{
          _id: string;
          customerName: string;
          totalSpent: number;
          salesCount: number;
        }>([
          {
            $match: {
              businessId,
              date: dateMatch,
              customerId: { $exists: true, $ne: null },
            },
          },
          {
            $group: {
              _id: "$customerId",
              customerName: { $first: "$customerName" },
              totalSpent: { $sum: "$total" },
              salesCount: { $sum: 1 },
            },
          },
          { $sort: { totalSpent: -1 } },
          { $limit: TOP_CUSTOMERS_LIMIT },
        ])
        .toArray(),

      getTrendPoints(businessId, range),

      // Reuses the profit-fund summary — one source of truth for the
      // tier math across M7 and M8.
      getProfitFundSummary(businessId, range),
    ]);

  const core = coreAgg[0];
  const totalSales = core?.totalSales ?? 0;
  const totalProfit = core?.totalProfit ?? 0;
  const salesCount = core?.count ?? 0;

  const topItems: TopItem[] = topItemsAgg.map((row) => ({
    productId: row._id,
    productName: row.productName,
    qtySold: row.qtySold,
    revenue: row.revenue,
  }));

  const topCustomers: TopCustomer[] = topCustomersAgg.map((row) => ({
    customerId: row._id,
    customerName: row.customerName,
    totalSpent: row.totalSpent,
    salesCount: row.salesCount,
  }));

   // Include any tier with a non-zero allocation for this range — even
  // if it has since been disabled. Disabling a tier stops future sales
  // from contributing, but the historical contribution must still be
  // reflected in the range's breakdown.
  const profitFundBreakdown: ProfitFundBreakdownLine[] = fundSummary.tiers
    .filter((t) => t.rangeAllocation !== 0)
    .map((t) => ({
      tierId: t.id,
      tierName: t.name,
      percentage: t.percentage,
      amount: t.rangeAllocation,
    }));

  const totalFundAmount = profitFundBreakdown.reduce(
    (sum, line) => sum + line.amount,
    0
  );
  const netProfitAfterFunds = totalProfit - totalFundAmount;

  return {
    range,
    totalSales,
    totalProfit,
    salesCount,
    profitFundBreakdown,
    netProfitAfterFunds,
    topItems,
    topCustomers,
    trend,
  };
}

async function getTrendPoints(
  businessId: string,
  range: DashboardRange
): Promise<TrendPoint[]> {
  const db = await getDb();

  const rangeDays = Math.round(
    (new Date(range.to).getTime() - new Date(range.from).getTime()) /
      (1000 * 60 * 60 * 24)
  );
  const bucketByMonth = rangeDays > DAY_BUCKET_MAX_DAYS;

  // Sale.date is stored as a "YYYY-MM-DD" string, so slicing it with
  // $substrBytes gives us stable day ("YYYY-MM-DD") or month ("YYYY-MM")
  // buckets without any timezone math.
  const groupIdExpr = bucketByMonth
    ? { $substrBytes: ["$date", 0, 7] }
    : { $substrBytes: ["$date", 0, 10] };

  const rows = await db
    .collection<Sale>("sales")
    .aggregate<{ _id: string; sales: number; profit: number }>([
      {
        $match: {
          businessId,
          date: { $gte: range.from, $lte: range.to },
        },
      },
      {
        $group: {
          _id: groupIdExpr,
          sales: { $sum: "$total" },
          profit: { $sum: "$profit" },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray();

  return rows.map((row) => ({
    label: row._id,
    sales: row.sales,
    profit: row.profit,
  }));
}