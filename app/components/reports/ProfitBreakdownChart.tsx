// app/components/reports/ProfitBreakdownChart.tsx
"use client";

import { ArrowDown } from "lucide-react";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { formatCurrency } from "@/lib/format";
import { translate, type Dictionary } from "@/lib/i18n";
import type { ProfitFundBreakdownLine } from "@/types";

interface ProfitBreakdownChartProps {
  grossProfit: number;
  breakdown: ProfitFundBreakdownLine[];
  netProfit: number;
  dictionary: Dictionary;
}

export function ProfitBreakdownChart({
  grossProfit,
  breakdown,
  netProfit,
  dictionary,
}: ProfitBreakdownChartProps) {
  const hasTiers = breakdown.length > 0;
  const canScale = grossProfit > 0;
  const widthPct = (amount: number) =>
    canScale ? Math.max(0, Math.min(100, (amount / grossProfit) * 100)) : 0;

  return (
    <div className="flex flex-col gap-3">
      <Row
        label={translate(dictionary, "reports.breakdown.grossProfit")}
        amount={grossProfit}
        pct={canScale ? 100 : 0}
        tone="primary"
      />

      {hasTiers ? (
        breakdown.map((line) => (
          <div key={line.tierId} className="flex flex-col gap-2">
            <Row
              label={translate(dictionary, "reports.breakdown.deduction", {
                name: line.tierName,
              })}
              amount={-line.amount}
              pct={widthPct(line.amount)}
              tone="warning"
              indent
            />
          </div>
        ))
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-surface-muted px-3 py-4 text-center">
          <p className="text-sm font-medium text-foreground">
            {translate(dictionary, "reports.breakdown.noTiers")}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {translate(dictionary, "reports.breakdown.noTiersHint")}
          </p>
        </div>
      )}

      <div className="flex justify-center">
        <ArrowDown className="h-4 w-4 text-text-muted" aria-hidden="true" />
      </div>

      <Row
        label={translate(dictionary, "reports.breakdown.netProfit")}
        amount={netProfit}
        pct={widthPct(Math.max(netProfit, 0))}
        tone="success"
        emphasized
      />
    </div>
  );
}

function Row({
  label,
  amount,
  pct,
  tone,
  indent = false,
  emphasized = false,
}: {
  label: string;
  amount: number;
  pct: number;
  tone: "primary" | "warning" | "success";
  indent?: boolean;
  emphasized?: boolean;
}) {
  const barClasses =
    tone === "primary"
      ? "bg-primary"
      : tone === "warning"
        ? "bg-warning"
        : "bg-success";

  return (
    <div className={["flex flex-col gap-1.5", indent ? "ps-4" : ""].join(" ")}>
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={[
            emphasized ? "text-sm font-semibold" : "text-sm",
            "text-foreground",
          ].join(" ")}
        >
          {label}
        </span>
        <span
          className={[
            "tabular-nums",
            emphasized
              ? "text-base font-bold text-foreground"
              : "text-sm font-medium text-foreground",
          ].join(" ")}
        >
          {amount < 0
            ? `− ${formatCurrency(Math.abs(amount))}`
            : formatCurrency(amount)}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          className={["h-full rounded-full transition-[width]", barClasses].join(
            " "
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}