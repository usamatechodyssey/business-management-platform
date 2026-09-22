// app/components/settings/ExportTab.tsx
//
// Settings tab that lets the owner download CSV files or open a
// print-ready page. Range-based exports (sales, ledger) share one range
// picker at the top of the section.

"use client";

import { useState } from "react";
import {
  Download,
  FileText,
  Printer,
  Package,
  Users,
  Truck,
  ShoppingCart,
  BookOpen,
} from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { useToast } from "@/app/components/ui/Toast";
import { translate, type Dictionary, type TranslationKey } from "@/lib/i18n";
import type { RangePreset } from "@/types";

interface ExportTabProps {
  dictionary: Dictionary;
}

interface SnapshotCard {
  key: "products" | "customers" | "suppliers";
  labelKey: TranslationKey;
  descKey: TranslationKey;
  url: string;
  icon: typeof Package;
}

interface RangeCard {
  key: "sales" | "ledger";
  labelKey: TranslationKey;
  descKey: TranslationKey;
  url: string;
  icon: typeof ShoppingCart;
}

const SNAPSHOT_EXPORTS: SnapshotCard[] = [
  {
    key: "products",
    labelKey: "export.productsLabel",
    descKey: "export.productsDescription",
    url: "/api/export/products",
    icon: Package,
  },
  {
    key: "customers",
    labelKey: "export.customersLabel",
    descKey: "export.customersDescription",
    url: "/api/export/customers",
    icon: Users,
  },
  {
    key: "suppliers",
    labelKey: "export.suppliersLabel",
    descKey: "export.suppliersDescription",
    url: "/api/export/suppliers",
    icon: Truck,
  },
];

const RANGE_EXPORTS: RangeCard[] = [
  {
    key: "sales",
    labelKey: "export.salesLabel",
    descKey: "export.salesDescription",
    url: "/api/export/sales",
    icon: ShoppingCart,
  },
  {
    key: "ledger",
    labelKey: "export.ledgerLabel",
    descKey: "export.ledgerDescription",
    url: "/api/export/ledger",
    icon: BookOpen,
  },
];

const RANGE_OPTIONS: { value: RangePreset; labelKey: TranslationKey }[] = [
  { value: "today", labelKey: "dashboard.ranges.today" },
  { value: "week", labelKey: "dashboard.ranges.week" },
  { value: "month", labelKey: "dashboard.ranges.month" },
  { value: "quarter", labelKey: "dashboard.ranges.quarter" },
  { value: "halfYear", labelKey: "dashboard.ranges.halfYear" },
  { value: "year", labelKey: "dashboard.ranges.year" },
  { value: "custom", labelKey: "dashboard.ranges.custom" },
];

function todayInPKT(): string {
  const shifted = new Date(Date.now() + 5 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function ExportTab({ dictionary }: ExportTabProps) {
  const { push } = useToast();

  const [range, setRange] = useState<RangePreset>("month");
  const [customFrom, setCustomFrom] = useState(todayInPKT());
  const [customTo, setCustomTo] = useState(todayInPKT());
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  function buildQuery(): string | null {
    const params = new URLSearchParams();
    params.set("range", range);
    if (range === "custom") {
      if (!customFrom || !customTo) return null;
      params.set("from", customFrom);
      params.set("to", customTo);
    }
    return params.toString();
  }

  function handleSnapshotDownload(card: SnapshotCard) {
    setIsDownloading(card.key);
    // Content-Disposition: attachment on the server means the browser
    // navigates, receives a file, and stays on this page.
    window.location.href = card.url;
    window.setTimeout(() => setIsDownloading(null), 1500);
  }

  function handleRangeDownload(card: RangeCard) {
    const query = buildQuery();
    if (!query) {
      push({
        message: translate(
          dictionary,
          "export.errors.customRangeRequired"
        ),
        variant: "error",
      });
      return;
    }
    setIsDownloading(card.key);
    window.location.href = `${card.url}?${query}`;
    window.setTimeout(() => setIsDownloading(null), 1500);
  }

  function handlePrintOpen() {
    const query = buildQuery();
    if (!query) {
      push({
        message: translate(
          dictionary,
          "export.errors.customRangeRequired"
        ),
        variant: "error",
      });
      return;
    }
    // Open the print page in a new tab so the owner keeps the settings
    // page open in the original tab.
    window.open(`/print/settings?${query}`, "_blank", "noopener,noreferrer");
  }

  const customRangeInvalid =
    range === "custom" && (!customFrom || !customTo);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          {translate(dictionary, "export.title")}
        </h2>
        <p className="mt-0.5 text-sm text-text-muted">
          {translate(dictionary, "export.subtitle")}
        </p>
      </div>

      {/* Snapshot section */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {translate(dictionary, "export.snapshotHeading")}
          </h3>
          <p className="text-xs text-text-muted">
            {translate(dictionary, "export.snapshotDescription")}
          </p>
        </div>

        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {SNAPSHOT_EXPORTS.map((card) => {
            const Icon = card.icon;
            const isBusy = isDownloading === card.key;
            return (
              <li
                key={card.key}
                className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3"
              >
                <div className="flex items-start gap-2">
                  <Icon
                    className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {translate(dictionary, card.labelKey)}
                    </p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {translate(dictionary, card.descKey)}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleSnapshotDownload(card)}
                  disabled={isBusy}
                  leadingIcon={
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  }
                >
                  {translate(dictionary, "export.downloadCsv")}
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Range picker */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {translate(dictionary, "export.rangeHeading")}
          </h3>
          <p className="text-xs text-text-muted">
            {translate(dictionary, "export.rangeDescription")}
          </p>
        </div>

        <div
          role="group"
          aria-label={translate(dictionary, "dashboard.rangeLabel")}
          className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface p-1"
        >
          {RANGE_OPTIONS.map((opt) => {
            const isActive = range === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRange(opt.value)}
                aria-pressed={isActive}
                className={[
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  isActive
                    ? "bg-primary text-white"
                    : "text-text-muted hover:bg-surface-muted",
                ].join(" ")}
              >
                {translate(dictionary, opt.labelKey)}
              </button>
            );
          })}
        </div>

        {range === "custom" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-md">
            <Input
              label={translate(dictionary, "dashboard.ranges.from")}
              name="from"
              type="date"
              value={customFrom}
              onChange={(event) => setCustomFrom(event.target.value)}
            />
            <Input
              label={translate(dictionary, "dashboard.ranges.to")}
              name="to"
              type="date"
              value={customTo}
              onChange={(event) => setCustomTo(event.target.value)}
            />
          </div>
        )}
      </section>

      {/* Range-based exports */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {translate(dictionary, "export.rangeBasedHeading")}
          </h3>
          <p className="text-xs text-text-muted">
            {translate(dictionary, "export.rangeBasedDescription")}
          </p>
        </div>

        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {RANGE_EXPORTS.map((card) => {
            const Icon = card.icon;
            const isBusy = isDownloading === card.key;
            return (
              <li
                key={card.key}
                className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3"
              >
                <div className="flex items-start gap-2">
                  <Icon
                    className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {translate(dictionary, card.labelKey)}
                    </p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {translate(dictionary, card.descKey)}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleRangeDownload(card)}
                  disabled={isBusy || customRangeInvalid}
                  leadingIcon={
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  }
                >
                  {translate(dictionary, "export.downloadCsv")}
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Print section */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {translate(dictionary, "export.printHeading")}
          </h3>
          <p className="text-xs text-text-muted">
            {translate(dictionary, "export.printDescription")}
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <div className="flex items-start gap-2">
            <Printer
              className="mt-0.5 h-4 w-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                <FileText
                  className="me-1.5 inline h-4 w-4 align-text-bottom"
                  aria-hidden="true"
                />
                {translate(dictionary, "export.printTitle")}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                {translate(dictionary, "export.printSubtitle")}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handlePrintOpen}
            disabled={customRangeInvalid}
            leadingIcon={<Printer className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            {translate(dictionary, "export.openPrint")}
          </Button>
          <p className="text-xs text-text-muted">
            {translate(dictionary, "export.printHint")}
          </p>
        </div>
      </section>
    </div>
  );
}