// app/(dashboard)/reports/ReportsClient.tsx
"use client";

import { useSearchParams } from "next/navigation";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { MetricCard } from "@/app/components/dashboard/MetricCard";
import { TimeRangePicker } from "@/app/components/dashboard/TimeRangePicker";
import { TrendChart } from "@/app/components/reports/TrendChart";
import { ProfitBreakdownChart } from "@/app/components/reports/ProfitBreakdownChart";
import { Table, type TableColumn } from "@/app/components/ui/Table";
import { formatCurrency } from "@/lib/format";
import { translate, type Dictionary, type Locale } from "@/lib/i18n";
import type {
  RangePreset,
  ReportSummary,
  TopCustomer,
  TopItem,
} from "@/types";

interface ReportsClientProps {
  summary: ReportSummary;
  rangePreset: RangePreset;
  rangeFrom?: string;
  rangeTo?: string;
  locale: Locale;
  dictionary: Dictionary;
}

// Kept outside the component so the column arrays are only constructed
// when they need to be (translate is pure but not free).
function buildTopItemColumns(
  dictionary: Dictionary
): TableColumn<TopItem>[] {
  return [
    {
      key: "productName",
      header: translate(dictionary, "reports.topItems.columns.name"),
      render: (row) => (
        <span className="font-medium text-foreground">{row.productName}</span>
      ),
    },
    {
      key: "qtySold",
      header: translate(dictionary, "reports.topItems.columns.qty"),
      align: "end",
      render: (row) => <span className="tabular-nums">{row.qtySold}</span>,
    },
    {
      key: "revenue",
      header: translate(dictionary, "reports.topItems.columns.revenue"),
      align: "end",
      render: (row) => (
        <span className="font-medium tabular-nums">
          {formatCurrency(row.revenue)}
        </span>
      ),
    },
  ];
}

function buildTopCustomerColumns(
  dictionary: Dictionary
): TableColumn<TopCustomer>[] {
  return [
    {
      key: "customerName",
      header: translate(dictionary, "reports.topCustomers.columns.name"),
      render: (row) => (
        <span className="font-medium text-foreground">{row.customerName}</span>
      ),
    },
    {
      key: "salesCount",
      header: translate(dictionary, "reports.topCustomers.columns.salesCount"),
      align: "end",
      render: (row) => <span className="tabular-nums">{row.salesCount}</span>,
    },
    {
      key: "totalSpent",
      header: translate(dictionary, "reports.topCustomers.columns.spent"),
      align: "end",
      render: (row) => (
        <span className="font-medium tabular-nums">
          {formatCurrency(row.totalSpent)}
        </span>
      ),
    },
  ];
}

export function ReportsClient({
  summary,
  rangePreset,
  rangeFrom,
  rangeTo,
  locale,
  dictionary,
}: ReportsClientProps) {
  // Read search params so the component re-renders when the picker
  // pushes a new URL. Same pattern as ProfitFundClient.
  void useSearchParams();

  const isEmpty = summary.salesCount === 0;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {translate(dictionary, "reports.title")}
          </h1>
          <p className="text-sm text-text-muted">
            {translate(dictionary, "reports.subtitle")}
          </p>
        </div>
        <TimeRangePicker
          preset={rangePreset}
          from={rangeFrom}
          to={rangeTo}
          dictionary={dictionary}
          basePath="/reports"
        />
      </div>

      {isEmpty ? (
        <EmptyState
          title={translate(dictionary, "reports.empty.title")}
          description={translate(dictionary, "reports.empty.description")}
        />
      ) : (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label={translate(dictionary, "reports.metrics.sales")}
              value={formatCurrency(summary.totalSales)}
              hint={translate(dictionary, "reports.metrics.salesCountHint", {
                count: summary.salesCount,
              })}
            />
            <MetricCard
              label={translate(dictionary, "reports.metrics.profit")}
              value={formatCurrency(summary.totalProfit)}
            />
            <MetricCard
              label={translate(dictionary, "reports.metrics.netProfit")}
              value={formatCurrency(summary.netProfitAfterFunds)}
              variant={
                summary.netProfitAfterFunds > 0
                  ? "success"
                  : summary.netProfitAfterFunds < 0
                    ? "danger"
                    : "default"
              }
            />
          </div>

          {/* Trend */}
          <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
            <h2 className="text-base font-semibold text-foreground">
              {translate(dictionary, "reports.sections.trend")}
            </h2>
            <TrendChart
              trend={summary.trend}
              locale={locale}
              dictionary={dictionary}
            />
          </section>

          {/* Profit breakdown */}
          <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
            <h2 className="text-base font-semibold text-foreground">
              {translate(dictionary, "reports.sections.breakdown")}
            </h2>
            <ProfitBreakdownChart
              grossProfit={summary.totalProfit}
              breakdown={summary.profitFundBreakdown}
              netProfit={summary.netProfitAfterFunds}
              dictionary={dictionary}
            />
          </section>

          {/* Top items */}
          <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
            <h2 className="text-base font-semibold text-foreground">
              {translate(dictionary, "reports.sections.topItems")}
            </h2>
            <Table
              columns={buildTopItemColumns(dictionary)}
              data={summary.topItems}
              getRowId={(row) => row.productId}
              emptyMessage={translate(dictionary, "reports.topItems.empty")}
            />
          </section>

          {/* Top customers */}
          <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
            <h2 className="text-base font-semibold text-foreground">
              {translate(dictionary, "reports.sections.topCustomers")}
            </h2>
            <Table
              columns={buildTopCustomerColumns(dictionary)}
              data={summary.topCustomers}
              getRowId={(row) => row.customerId}
              emptyMessage={translate(
                dictionary,
                "reports.topCustomers.empty"
              )}
            />
          </section>
        </>
      )}
    </div>
  );
}