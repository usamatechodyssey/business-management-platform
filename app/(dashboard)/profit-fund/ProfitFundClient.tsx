// app/(dashboard)/profit-fund/ProfitFundClient.tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { Modal } from "@/app/components/ui/Modal";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { useToast } from "@/app/components/ui/Toast";
import { MetricCard } from "@/app/components/dashboard/MetricCard";
import { TimeRangePicker } from "@/app/components/dashboard/TimeRangePicker";
import { TierFormModal } from "@/app/components/profit-fund/TierFormModal";
import { TierBreakdownCard } from "@/app/components/profit-fund/TierBreakdownCard";
import { DisbursementModal } from "@/app/components/profit-fund/DisbursementModal";
import { TierHistoryModal } from "@/app/components/profit-fund/TierHistoryModal";
import { TierRatesModal } from "@/app/components/profit-fund/TierRatesModal";
import { formatCurrency } from "@/lib/format";
import { translate, type Dictionary, type Locale } from "@/lib/i18n";
import type {
  ProfitFundDisbursement,
  ProfitFundSummary,
  ProfitFundTierRate,
  ProfitFundTierSnapshot,
  RangePreset,
} from "@/types";

interface ProfitFundClientProps {
  summary: ProfitFundSummary;
  rangePreset: RangePreset;
  rangeFrom?: string;
  rangeTo?: string;
  locale: Locale;
  dictionary: Dictionary;
}

export function ProfitFundClient({
  summary,
  rangePreset,
  rangeFrom,
  rangeTo,
  locale,
  dictionary,
}: ProfitFundClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { push: pushToast } = useToast();

  const [tierFormTarget, setTierFormTarget] = useState<
    ProfitFundTierSnapshot | null | undefined
  >(undefined);

  const [disbursementTarget, setDisbursementTarget] =
    useState<ProfitFundTierSnapshot | null>(null);

  const [historyTarget, setHistoryTarget] =
    useState<ProfitFundTierSnapshot | null>(null);
  const [historyEntries, setHistoryEntries] = useState<
    ProfitFundDisbursement[]
  >([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [ratesTarget, setRatesTarget] =
    useState<ProfitFundTierSnapshot | null>(null);
  const [ratesEntries, setRatesEntries] = useState<ProfitFundTierRate[]>([]);
  const [isLoadingRates, setIsLoadingRates] = useState(false);

  const [deleteTarget, setDeleteTarget] =
    useState<ProfitFundTierSnapshot | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function handleAddTier() {
    setTierFormTarget(null);
  }

  function handleEditTier(tier: ProfitFundTierSnapshot) {
    setTierFormTarget(tier);
  }

  function handleTierFormSuccess() {
    setTierFormTarget(undefined);
    router.refresh();
  }

  function handleDisburse(tier: ProfitFundTierSnapshot) {
    setHistoryTarget(null);
    setDisbursementTarget(tier);
  }

  function handleDisbursementSuccess() {
    setDisbursementTarget(null);
    router.refresh();
  }

  function handleViewLedger(tier: ProfitFundTierSnapshot) {
    router.push(`/profit-fund/${tier.id}/ledger`);
  }

  async function handleViewHistory(tier: ProfitFundTierSnapshot) {
    setHistoryTarget(tier);
    setHistoryEntries([]);
    setIsLoadingHistory(true);
    try {
      const response = await fetch(
        `/api/profit-fund-tiers/${tier.id}/disbursements`
      );
      if (!response.ok) {
        throw new Error(`Failed to load history (${response.status})`);
      }
      const body = (await response.json()) as {
        data: { disbursements: ProfitFundDisbursement[] };
      };
      setHistoryEntries(body.data.disbursements);
    } catch {
      pushToast({
        message: translate(dictionary, "errors.generic"),
        variant: "error",
      });
      setHistoryTarget(null);
    } finally {
      setIsLoadingHistory(false);
    }
  }

  async function handleViewRates(tier: ProfitFundTierSnapshot) {
    setRatesTarget(tier);
    setRatesEntries([]);
    setIsLoadingRates(true);
    try {
      const response = await fetch(
        `/api/profit-fund-tiers/${tier.id}/rates`
      );
      if (!response.ok) {
        throw new Error(`Failed to load rates (${response.status})`);
      }
      const body = (await response.json()) as {
        data: { rates: ProfitFundTierRate[] };
      };
      setRatesEntries(body.data.rates);
    } catch {
      pushToast({
        message: translate(dictionary, "errors.generic"),
        variant: "error",
      });
      setRatesTarget(null);
    } finally {
      setIsLoadingRates(false);
    }
  }

  async function handleToggleEnabled(tier: ProfitFundTierSnapshot) {
    try {
      const response = await fetch(`/api/profit-fund-tiers/${tier.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !tier.enabled }),
      });
      if (!response.ok) {
        throw new Error(`Toggle failed (${response.status})`);
      }
      pushToast({
        message: translate(dictionary, "profitFund.updated"),
        variant: "success",
      });
      router.refresh();
    } catch {
      pushToast({
        message: translate(dictionary, "errors.generic"),
        variant: "error",
      });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/profit-fund-tiers/${deleteTarget.id}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        let body: { error?: { code?: string } } | null = null;
        try {
          body = (await response.json()) as { error?: { code?: string } };
        } catch {
          body = null;
        }
        if (body?.error?.code === "TIER_HAS_DISBURSEMENTS") {
          pushToast({
            message: translate(
              dictionary,
              "profitFund.errors.hasDisbursements"
            ),
            variant: "error",
          });
        } else {
          pushToast({
            message: translate(dictionary, "errors.generic"),
            variant: "error",
          });
        }
        setDeleteTarget(null);
        return;
      }
      pushToast({
        message: translate(dictionary, "profitFund.deleted"),
        variant: "success",
      });
      setDeleteTarget(null);
      router.refresh();
    } catch {
      pushToast({
        message: translate(dictionary, "errors.generic"),
        variant: "error",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  const rangeLabel = (() => {
    const key = `dashboard.ranges.${rangePreset}` as const;
    try {
      return translate(dictionary, key);
    } catch {
      return translate(dictionary, "dashboard.ranges.month");
    }
  })();

  const hasTiers = summary.tiers.length > 0;
  const totalPercentage = summary.tiers
    .filter((t) => t.enabled)
    .reduce((sum, t) => sum + t.percentage, 0);

  void searchParams;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {translate(dictionary, "profitFund.title")}
          </h1>
          <p className="text-sm text-text-muted">
            {translate(dictionary, "profitFund.subtitle")}
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={handleAddTier}
          leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
        >
          {translate(dictionary, "profitFund.addTier")}
        </Button>
      </div>

      <TimeRangePicker
        preset={rangePreset}
        from={rangeFrom}
        to={rangeTo}
        dictionary={dictionary}
        basePath="/profit-fund"
      />

      {hasTiers && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label={translate(dictionary, "profitFund.summary.rangeProfit", {
              range: rangeLabel,
            })}
            value={formatCurrency(summary.rangeProfit)}
          />
          <MetricCard
            label={translate(dictionary, "profitFund.summary.totalAllocated")}
            value={formatCurrency(summary.totalRangeAllocation)}
            hint={translate(
              dictionary,
              "profitFund.summary.totalPercentageLabel",
              { percentage: totalPercentage }
            )}
            variant="success"
          />
          <MetricCard
            label={translate(dictionary, "profitFund.summary.totalDisbursed")}
            value={formatCurrency(summary.totalLifetimeDisbursed)}
          />
          <MetricCard
            label={translate(dictionary, "profitFund.summary.totalAvailable")}
            value={formatCurrency(summary.totalAvailableBalance)}
            variant={summary.totalAvailableBalance > 0 ? "success" : "default"}
          />
        </div>
      )}

      {!hasTiers ? (
        <EmptyState
          title={translate(dictionary, "profitFund.empty.title")}
          description={translate(dictionary, "profitFund.empty.description")}
          action={
            <Button type="button" variant="primary" onClick={handleAddTier}>
              {translate(dictionary, "profitFund.empty.addFirst")}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {summary.tiers.map((tier) => (
            <TierBreakdownCard
              key={tier.id}
              tier={tier}
              dictionary={dictionary}
              onViewLedger={handleViewLedger}
              onViewHistory={handleViewHistory}
              onViewRates={handleViewRates}
              onDisburse={handleDisburse}
              onEdit={handleEditTier}
              onToggleEnabled={handleToggleEnabled}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      <TierFormModal
        isOpen={tierFormTarget !== undefined}
        onClose={() => setTierFormTarget(undefined)}
        tier={tierFormTarget ?? null}
        rangeProfit={summary.rangeProfit}
        dictionary={dictionary}
        onSuccess={handleTierFormSuccess}
      />

      {disbursementTarget && (
        <DisbursementModal
          isOpen={true}
          onClose={() => setDisbursementTarget(null)}
          tier={disbursementTarget}
          dictionary={dictionary}
          onSuccess={handleDisbursementSuccess}
        />
      )}

      {historyTarget && (
        <TierHistoryModal
          isOpen={true}
          onClose={() => setHistoryTarget(null)}
          tier={historyTarget}
          disbursements={historyEntries}
          isLoading={isLoadingHistory}
          locale={locale}
          dictionary={dictionary}
        />
      )}

      {ratesTarget && (
        <TierRatesModal
          isOpen={true}
          onClose={() => setRatesTarget(null)}
          tier={ratesTarget}
          rates={ratesEntries}
          isLoading={isLoadingRates}
          locale={locale}
          dictionary={dictionary}
        />
      )}

      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={translate(dictionary, "profitFund.deleteConfirm.title")}
        closeOnBackdropClick={!isDeleting}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              {translate(dictionary, "profitFund.deleteConfirm.cancel")}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={confirmDelete}
              isLoading={isDeleting}
            >
              {translate(dictionary, "profitFund.deleteConfirm.confirm")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-foreground">
          {translate(dictionary, "profitFund.deleteConfirm.description")}
        </p>
      </Modal>
    </div>
  );
}