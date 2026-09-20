// app/(dashboard)/dashboard/page.tsx
//
// Server Component. Reads the time-range from the URL, resolves it in PKT
// (lib/dashboard.ts), queries MongoDB directly via the shared logic, and
// renders the metric grid + top items list. No API round-trip — Next.js
// App Router idiomatic server-first data fetching.

import Link from "next/link";
import { getTenantContext } from "@/lib/tenant";
import { getDictionary, translate } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { getDashboardSummary, resolveRange } from "@/lib/dashboard";
import { formatCurrency } from "@/lib/format";
import { MetricCard } from "@/app/components/dashboard/MetricCard";
import { TopItemsList } from "@/app/components/dashboard/TopItemsList";
import { TimeRangePicker } from "@/app/components/dashboard/TimeRangePicker";

interface DashboardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const preset = typeof params.range === "string" ? params.range : undefined;
  const customFrom = typeof params.from === "string" ? params.from : undefined;
  const customTo = typeof params.to === "string" ? params.to : undefined;

  const tenant = await getTenantContext();
  const locale = await getLocale();
  const dictionary = getDictionary(locale);

  const range = resolveRange(preset, customFrom, customTo);
  const summary = await getDashboardSummary(tenant.businessId, range);

  const isBrandNew = summary.metrics.productsCount === 0;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-foreground">
          {translate(dictionary, "nav.dashboard")}
        </h1>
        <TimeRangePicker
          preset={range.preset}
          from={range.preset === "custom" ? customFrom : undefined}
          to={range.preset === "custom" ? customTo : undefined}
          dictionary={dictionary}
        />
      </div>

      {isBrandNew && (
        <div className="rounded-xl border border-border bg-surface p-6 text-center shadow-sm">
          <h2 className="text-base font-semibold text-foreground">
            {translate(dictionary, "dashboard.empty.welcomeTitle")}
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            {translate(dictionary, "dashboard.empty.welcomeDescription")}
          </p>
          <Link
            href="/inventory"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {translate(dictionary, "dashboard.empty.addProduct")}
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label={translate(dictionary, "dashboard.metrics.sales")}
          value={formatCurrency(summary.metrics.totalSales)}
        />
        <MetricCard
          label={translate(dictionary, "dashboard.metrics.profit")}
          value={formatCurrency(summary.metrics.totalProfit)}
          variant="success"
        />
        <MetricCard
          label={translate(dictionary, "dashboard.metrics.receivables")}
          value={formatCurrency(summary.metrics.totalReceivables)}
          hint={translate(dictionary, "dashboard.metrics.receivablesHint", {
            count: summary.metrics.customersWithDue,
          })}
          variant="warning"
        />
        <MetricCard
          label={translate(dictionary, "dashboard.metrics.lowStock")}
          value={String(summary.metrics.lowStockCount)}
          variant={summary.metrics.lowStockCount > 0 ? "danger" : "default"}
        />
      </div>

      <TopItemsList items={summary.topItems} dictionary={dictionary} />
    </div>
  );
}