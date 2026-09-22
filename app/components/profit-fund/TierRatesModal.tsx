// app/components/profit-fund/TierRatesModal.tsx
"use client";

import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { Table, type TableColumn } from "@/app/components/ui/Table";
import { Loader } from "@/app/components/ui/Loader";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { formatDateTime } from "@/lib/format";
import { translate, type Dictionary, type Locale } from "@/lib/i18n";
import type { ProfitFundTier, ProfitFundTierRate } from "@/types";

interface TierRatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier: ProfitFundTier;
  rates: ProfitFundTierRate[];
  isLoading: boolean;
  locale: Locale;
  dictionary: Dictionary;
}

export function TierRatesModal({
  isOpen,
  onClose,
  tier,
  rates,
  isLoading,
  locale,
  dictionary,
}: TierRatesModalProps) {
  const columns: TableColumn<ProfitFundTierRate>[] = [
    {
      key: "effectiveFrom",
      header: translate(dictionary, "profitFund.rates.columns.from"),
      render: (r) => (
        <span className="text-xs">{formatDateTime(r.effectiveFrom, locale)}</span>
      ),
    },
    {
      key: "percentage",
      header: translate(dictionary, "profitFund.rates.columns.percentage"),
      align: "end",
      render: (r) => (
        <span className="font-medium tabular-nums">{r.percentage}%</span>
      ),
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={translate(dictionary, "profitFund.rates.title", {
        name: tier.name,
      })}
      footer={
        <Button type="button" variant="secondary" onClick={onClose}>
          {translate(dictionary, "common.close")}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-text-muted">
          {translate(dictionary, "profitFund.rates.note")}
        </p>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader />
          </div>
        ) : rates.length === 0 ? (
          <EmptyState
            title={translate(dictionary, "profitFund.rates.empty.title")}
            description={translate(
              dictionary,
              "profitFund.rates.empty.description"
            )}
          />
        ) : (
          <Table columns={columns} data={rates} getRowId={(r) => r.id} />
        )}
      </div>
    </Modal>
  );
}