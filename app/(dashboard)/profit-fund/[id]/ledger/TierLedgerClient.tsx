// app/(dashboard)/profit-fund/[id]/ledger/TierLedgerClient.tsx
"use client";

import { Download, Printer } from "lucide-react";
import { Table, type TableColumn } from "@/app/components/ui/Table";
import { Button } from "@/app/components/ui/Button";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { TimeRangePicker } from "@/app/components/dashboard/TimeRangePicker";
import { MetricCard } from "@/app/components/dashboard/MetricCard";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { translate, type Dictionary, type Locale } from "@/lib/i18n";
import type { RangePreset } from "@/types";
import type { TierLedgerPeriod, TierLedgerReport } from "@/lib/tier-ledger";

interface TierLedgerClientProps {
  report: TierLedgerReport;
  rangePreset: RangePreset;
  rangeFrom?: string;
  rangeTo?: string;
  locale: Locale;
  dictionary: Dictionary;
}

export function TierLedgerClient({
  report,
  rangePreset,
  rangeFrom,
  rangeTo,
  locale,
  dictionary,
}: TierLedgerClientProps) {
  function buildQuery(): string {
    const params = new URLSearchParams();
    params.set("range", rangePreset);
    if (rangePreset === "custom" && rangeFrom && rangeTo) {
      params.set("from", rangeFrom);
      params.set("to", rangeTo);
    }
    return params.toString();
  }

  function handleCsvDownload() {
    window.location.href = `/api/export/tier-ledger/${report.tier.id}?${buildQuery()}`;
  }

  function handlePrintOpen() {
    window.open(
      `/print/tier-ledger/${report.tier.id}?${buildQuery()}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  const columns: TableColumn<TierLedgerPeriod>[] = [
    {
      key: "from",
      header: translate(dictionary, "tierLedger.columns.from"),
      render: (p) => (
        <span className="text-xs">{formatDateTime(p.from, locale)}</span>
      ),
    },
    {
      key: "to",
      header: translate(dictionary, "tierLedger.columns.to"),
      render: (p) =>
        p.to ? (
          <span className="text-xs">{formatDateTime(p.to, locale)}</span>
        ) : (
          <span className="text-xs text-text-muted">
            {translate(dictionary, "tierLedger.currentWindow")}
          </span>
        ),
    },
    {
      key: "percentage",
      header: translate(dictionary, "tierLedger.columns.percentage"),
      align: "end",
      render: (p) => (
        <span className="font-medium tabular-nums">{p.percentage}%</span>
      ),
    },
    {
      key: "profitInPeriod",
      header: translate(dictionary, "tierLedger.columns.profit"),
      align: "end",
      render: (p) => formatCurrency(p.profitInPeriod),
    },
    {
      key: "allocatedInPeriod",
      header: translate(dictionary, "tierLedger.columns.allocated"),
      align: "end",
      render: (p) => (
        <div className="flex flex-col items-end gap-0.5">
          <span className="font-medium text-primary">
            {formatCurrency(p.allocatedInPeriod)}
          </span>
          {p.allocatedInPeriod === 0 && p.profitInPeriod > 0 && (
            <span className="text-[10px] text-text-muted">
              {translate(dictionary, "tierLedger.notActive")}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "disbursedInPeriod",
      header: translate(dictionary, "tierLedger.columns.disbursed"),
      align: "end",
      render: (p) => formatCurrency(p.disbursedInPeriod),
    },
    {
      key: "runningBalance",
      header: translate(dictionary, "tierLedger.columns.balance"),
      align: "end",
      render: (p) => (
        <span className="font-semibold tabular-nums">
          {formatCurrency(p.runningBalance)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TimeRangePicker
          preset={rangePreset}
          from={rangeFrom}
          to={rangeTo}
          dictionary={dictionary}
          basePath={`/profit-fund/${report.tier.id}/ledger`}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleCsvDownload}
            leadingIcon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            {translate(dictionary, "tierLedger.downloadCsv")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handlePrintOpen}
            leadingIcon={<Printer className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            {translate(dictionary, "tierLedger.printPdf")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label={translate(dictionary, "tierLedger.summary.totalProfit")}
          value={formatCurrency(report.totals.totalProfit)}
        />
        <MetricCard
          label={translate(dictionary, "tierLedger.summary.totalAllocated")}
          value={formatCurrency(report.totals.totalAllocated)}
          variant="success"
        />
        <MetricCard
          label={translate(dictionary, "tierLedger.summary.totalDisbursed")}
          value={formatCurrency(report.totals.totalDisbursed)}
        />
        <MetricCard
          label={translate(dictionary, "tierLedger.summary.available")}
          value={formatCurrency(report.totals.availableBalance)}
          variant={report.totals.availableBalance > 0 ? "success" : "default"}
        />
      </div>

      {report.periods.length === 0 ? (
        <EmptyState
          title={translate(dictionary, "tierLedger.empty.title")}
          description={translate(dictionary, "tierLedger.empty.description")}
        />
      ) : (
        <Table
          columns={columns}
          data={report.periods}
          getRowId={(p) => p.from}
        />
      )}
    </div>
  );
}