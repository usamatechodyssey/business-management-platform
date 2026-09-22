// app/components/reports/TrendChart.tsx
//
// CSS-only bar chart. Bars are profit (dark, primary color); the sales
// number is available on hover via title. Normalized to the max profit
// in the range, so the shape of the trend is visible even when absolute
// amounts are small.

"use client";

import { EmptyState } from "@/app/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/format";
import { translate, type Dictionary, type Locale } from "@/lib/i18n";
import type { TrendPoint } from "@/types";

interface TrendChartProps {
  trend: TrendPoint[];
  locale: Locale;
  dictionary: Dictionary;
}

// "YYYY-MM-DD" → short day (e.g. "15"); "YYYY-MM" → short month (e.g.
// "Sep"). Keeps bar labels tiny on narrow screens.
function shortLabel(label: string, locale: Locale): string {
  if (label.length === 7) {
    // Monthly bucket — parse "YYYY-MM".
    const [year, month] = label.split("-");
    if (!year || !month) return label;
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString(locale === "ur" ? "ur-PK" : "en-PK", {
      month: "short",
    });
  }
  // Daily bucket — day-of-month only.
  const day = label.slice(8, 10);
  return day.replace(/^0/, "");
}

function fullLabel(label: string, locale: Locale): string {
  if (label.length === 7) {
    const [year, month] = label.split("-");
    if (!year || !month) return label;
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString(locale === "ur" ? "ur-PK" : "en-PK", {
      month: "long",
      year: "numeric",
    });
  }
  return formatDate(label, locale);
}

export function TrendChart({ trend, locale, dictionary }: TrendChartProps) {
  if (trend.length === 0) {
    return (
      <EmptyState
        title={translate(dictionary, "reports.trend.empty")}
      />
    );
  }

  // Bars represent profit. If every bucket has zero profit (rare, but
  // possible with a non-trivial range where sales were exactly break-even),
  // fall back to sales for the visual scale so something still renders.
  const maxProfit = Math.max(...trend.map((p) => p.profit), 0);
  const maxSales = Math.max(...trend.map((p) => p.sales), 0);
  const useSalesScale = maxProfit <= 0 && maxSales > 0;
  const max = useSalesScale ? maxSales : maxProfit;

  // Labels get cramped past ~14 buckets. Show every Nth to keep them
  // readable. First and last are always kept.
  const labelStride = Math.max(1, Math.ceil(trend.length / 14));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-48 items-end gap-1 overflow-x-auto pb-1">
        {trend.map((point, index) => {
          const value = useSalesScale ? point.sales : point.profit;
          const pct = max > 0 ? (value / max) * 100 : 0;
          const showLabel =
            index === 0 ||
            index === trend.length - 1 ||
            index % labelStride === 0;

          return (
            <div
              key={point.label}
              className="flex min-w-6 flex-1 flex-col items-center gap-1"
            >
              <div className="flex h-40 w-full items-end">
                <div
                  role="img"
                  aria-label={translate(
                    dictionary,
                    "reports.trend.profitTitle",
                    {
                      label: fullLabel(point.label, locale),
                      profit: formatCurrency(point.profit),
                      sales: formatCurrency(point.sales),
                    }
                  )}
                  title={translate(
                    dictionary,
                    "reports.trend.profitTitle",
                    {
                      label: fullLabel(point.label, locale),
                      profit: formatCurrency(point.profit),
                      sales: formatCurrency(point.sales),
                    }
                  )}
                  className="w-full rounded-t bg-primary transition-[height]"
                  style={{ height: `${Math.max(pct, 2)}%` }}
                />
              </div>
              <span className="h-4 text-[10px] leading-none text-text-muted">
                {showLabel ? shortLabel(point.label, locale) : ""}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-4 text-xs text-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-primary" aria-hidden="true" />
          {translate(dictionary, "reports.trend.profitLegend")}
        </span>
      </div>
    </div>
  );
}