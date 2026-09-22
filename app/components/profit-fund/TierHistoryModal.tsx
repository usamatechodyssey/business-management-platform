// app/components/profit-fund/TierHistoryModal.tsx
"use client";

import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { Table, type TableColumn } from "@/app/components/ui/Table";
import { Loader } from "@/app/components/ui/Loader";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/format";
import { translate, type Dictionary, type Locale } from "@/lib/i18n";
import type { ProfitFundDisbursement, ProfitFundTierSnapshot } from "@/types";

interface TierHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier: ProfitFundTierSnapshot;
  disbursements: ProfitFundDisbursement[];
  isLoading: boolean;
  locale: Locale;
  dictionary: Dictionary;
}

export function TierHistoryModal({
  isOpen,
  onClose,
  tier,
  disbursements,
  isLoading,
  locale,
  dictionary,
}: TierHistoryModalProps) {
  const columns: TableColumn<ProfitFundDisbursement>[] = [
    {
      key: "date",
      header: translate(dictionary, "profitFund.history.columns.date"),
      render: (d) => formatDate(d.date, locale),
    },
    {
      key: "amount",
      header: translate(dictionary, "profitFund.history.columns.amount"),
      align: "end",
      render: (d) => (
        <span className="font-medium tabular-nums">
          {formatCurrency(d.amount)}
        </span>
      ),
    },
    {
      key: "note",
      header: translate(dictionary, "profitFund.history.columns.note"),
      render: (d) => d.note ?? <span className="text-text-muted">—</span>,
    },
  ];

  const totalDisbursed = disbursements.reduce((sum, d) => sum + d.amount, 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={translate(dictionary, "profitFund.history.title", {
        name: tier.name,
      })}
      footer={
        <Button type="button" variant="secondary" onClick={onClose}>
          {translate(dictionary, "common.close")}
        </Button>
      }
    >
      {!isLoading && disbursements.length > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2">
          <span className="text-sm text-text-muted">
            {translate(dictionary, "profitFund.tier.lifetimeDisbursed")}
          </span>
          <span className="text-base font-semibold tabular-nums text-foreground">
            {formatCurrency(totalDisbursed)}
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader />
        </div>
      ) : disbursements.length === 0 ? (
        <EmptyState
          title={translate(dictionary, "profitFund.history.empty.title")}
          description={translate(
            dictionary,
            "profitFund.history.empty.description"
          )}
        />
      ) : (
        <Table
          columns={columns}
          data={disbursements}
          getRowId={(d) => d.id}
        />
      )}
    </Modal>
  );
}