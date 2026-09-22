// app/components/profit-fund/TierBreakdownCard.tsx
"use client";

import {
  History,
  BookOpen,
  Pencil,
  Power,
  PowerOff,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Badge } from "@/app/components/ui/Badge";
import { formatCurrency } from "@/lib/format";
import { translate, type Dictionary } from "@/lib/i18n";
import type { ProfitFundTierSnapshot } from "@/types";

interface TierBreakdownCardProps {
  tier: ProfitFundTierSnapshot;
  dictionary: Dictionary;
  onViewHistory: (tier: ProfitFundTierSnapshot) => void;
  onViewRates: (tier: ProfitFundTierSnapshot) => void;
  onDisburse: (tier: ProfitFundTierSnapshot) => void;
  onEdit: (tier: ProfitFundTierSnapshot) => void;
  onToggleEnabled: (tier: ProfitFundTierSnapshot) => void;
  onDelete: (tier: ProfitFundTierSnapshot) => void;
  onViewLedger: (tier: ProfitFundTierSnapshot) => void;
}

function ActionButton({
  label,
  tooltip,
  onClick,
  icon,
  tone = "neutral",
  disabled = false,
}: {
  label: string;
  tooltip?: string;
  onClick: () => void;
  icon: React.ReactNode;
  tone?: "neutral" | "primary" | "danger";
  disabled?: boolean;
}) {
  const toneClasses =
    tone === "danger"
      ? "hover:bg-danger/10 hover:text-danger"
      : tone === "primary"
        ? "hover:bg-primary/10 hover:text-primary"
        : "hover:bg-surface-muted hover:text-foreground";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={tooltip ?? label}
      className={[
        "rounded-md p-2 text-text-muted transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text-muted",
        toneClasses,
      ].join(" ")}
    >
      {icon}
    </button>
  );
}

export function TierBreakdownCard({
  tier,
  dictionary,
  onViewHistory,
  onViewRates,
  onDisburse,
  onEdit,
  onToggleEnabled,
  onDelete,
  onViewLedger,
}: TierBreakdownCardProps) {
  const isDisabled = !tier.enabled;
  const canDisburse = tier.availableBalance > 0 && tier.enabled;

  return (
    <div
      className={[
        "flex flex-col gap-3 rounded-xl border bg-surface p-4 shadow-sm",
        isDisabled ? "border-border opacity-80" : "border-primary/30",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-foreground">
              {tier.name}
            </h3>
            {isDisabled && (
              <Badge variant="neutral">
                {translate(dictionary, "profitFund.tier.disabled")}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {isDisabled ? (
        <div className="rounded-lg bg-surface-muted px-3 py-3 text-center text-sm text-text-muted">
          {tier.percentage}% —{" "}
          {translate(dictionary, "profitFund.tier.disabled")}
        </div>
      ) : (
        <div className="rounded-lg bg-primary/5 px-3 py-3">
          <p className="text-center text-xs text-text-muted">
            {translate(dictionary, "profitFund.tier.currentRate")}:{" "}
            <span className="font-semibold text-foreground">
              {tier.percentage}%
            </span>
          </p>
          <p className="mt-1 text-center text-xl font-bold text-primary tabular-nums">
            {formatCurrency(tier.rangeAllocation)}
          </p>
          <p className="text-center text-xs text-text-muted">
            {translate(dictionary, "profitFund.tier.rangeAllocationLabel")}
          </p>
        </div>
      )}

      <dl className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
        <div>
          <dt className="text-xs text-text-muted">
            {translate(dictionary, "profitFund.tier.lifetimeAllocation")}
          </dt>
          <dd className="text-sm font-semibold tabular-nums text-foreground">
            {formatCurrency(tier.lifetimeAllocation)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">
            {translate(dictionary, "profitFund.tier.lifetimeDisbursed")}
          </dt>
          <dd className="text-sm font-semibold tabular-nums text-foreground">
            {formatCurrency(tier.lifetimeDisbursed)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">
            {translate(dictionary, "profitFund.tier.availableBalance")}
          </dt>
          <dd
            className={[
              "text-sm font-semibold tabular-nums",
              tier.availableBalance > 0 ? "text-success" : "text-foreground",
            ].join(" ")}
          >
            {formatCurrency(tier.availableBalance)}
          </dd>
        </div>
      </dl>

      <div className="flex items-center justify-end gap-1 border-t border-border pt-2">
        <ActionButton
          label={translate(dictionary, "profitFund.tier.viewLedger")}
          onClick={() => onViewLedger(tier)}
          icon={<BookOpen className="h-4 w-4" aria-hidden="true" />}
        />
        <ActionButton
          label={translate(dictionary, "profitFund.tier.viewRates")}
          onClick={() => onViewRates(tier)}
          icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
        />
        <ActionButton
          label={translate(dictionary, "profitFund.tier.viewHistory")}
          onClick={() => onViewHistory(tier)}
          icon={<History className="h-4 w-4" aria-hidden="true" />}
        />
        <ActionButton
          label={translate(dictionary, "profitFund.tier.disburse")}
          onClick={() => onDisburse(tier)}
          icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
          tone="primary"
          disabled={!canDisburse}
        />
        <ActionButton
          label={translate(dictionary, "profitFund.tier.edit")}
          onClick={() => onEdit(tier)}
          icon={<Pencil className="h-4 w-4" aria-hidden="true" />}
        />
        <ActionButton
          label={translate(
            dictionary,
            tier.enabled
              ? "profitFund.tier.disable"
              : "profitFund.tier.enable"
          )}
          onClick={() => onToggleEnabled(tier)}
          icon={
            tier.enabled ? (
              <PowerOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Power className="h-4 w-4" aria-hidden="true" />
            )
          }
        />
        <ActionButton
          label={translate(dictionary, "profitFund.tier.delete")}
          onClick={() => onDelete(tier)}
          icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
          tone="danger"
        />
      </div>
    </div>
  );
}