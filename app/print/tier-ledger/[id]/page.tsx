// app/print/tier-ledger/[id]/page.tsx
//
// Print-friendly tier ledger. Lives outside the (dashboard) shell so no
// chrome renders on print. Accessed from the tier ledger page via the
// "Print / Save as PDF" button.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTenantContext, TenantError } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { getDictionary, translate } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { getTierById } from "@/lib/profit-fund";
import { resolveRange } from "@/lib/dashboard";
import { buildTierLedger } from "@/lib/tier-ledger";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { PrintButton } from "@/app/components/settings/PrintButton";
import { getDb } from "@/lib/db";
import type { Business } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function readString(value: string | string[] | undefined): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

export default async function PrintTierLedgerPage({
  params,
  searchParams,
}: PageProps) {
  const tenant = await getTenantContext();

  if (!hasPermission(tenant.role, "profitFund.view")) {
    throw new TenantError("You don't have permission to view this page.");
  }

  const { id } = await params;
  const search = await searchParams;

  const tier = await getTierById(tenant.businessId, id);
  if (!tier) notFound();

  const db = await getDb();
  const business = await db
    .collection<Business>("businesses")
    .findOne(
      { id: tenant.businessId },
      { projection: { name: 1, ownerName: 1, phone: 1 } }
    );

  const locale = await getLocale();
  const dictionary = getDictionary(locale);

  const preset = readString(search.range) || undefined;
  const customFrom = readString(search.from) || undefined;
  const customTo = readString(search.to) || undefined;

  const range = resolveRange(preset, customFrom, customTo);
  const report = await buildTierLedger(
    tenant.businessId,
    tier,
    range.from.slice(0, 10),
    range.to.slice(0, 10)
  );

  return (
    <div className="print-content mx-auto max-w-5xl bg-white p-4 text-black sm:p-8">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/profit-fund/${tier.id}/ledger`}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {translate(dictionary, "tierLedger.printBack")}
        </Link>
        <PrintButton label={translate(dictionary, "exportPrint.printButton")} />
      </div>

      <header className="mb-6 border-b-2 border-neutral-800 pb-3">
        <h1 className="text-2xl font-bold">
          {business?.name ?? ""} — {tier.name}
        </h1>
        <p className="mt-1 text-sm text-neutral-700">
          {translate(dictionary, "tierLedger.printSubtitle")}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          {translate(dictionary, "exportPrint.generated")}:{" "}
          {formatDateTime(report.generatedAt, locale)}
          {" · "}
          {translate(dictionary, "exportPrint.rangeLabel")}:{" "}
          {range.from.slice(0, 10)} → {range.to.slice(0, 10)}
        </p>
      </header>

      <section className="mb-6 grid grid-cols-4 gap-3 text-center">
        <div className="rounded border border-neutral-300 p-2">
          <p className="text-xs text-neutral-500">
            {translate(dictionary, "tierLedger.summary.totalProfit")}
          </p>
          <p className="text-base font-semibold">
            {formatCurrency(report.totals.totalProfit)}
          </p>
        </div>
        <div className="rounded border border-neutral-300 p-2">
          <p className="text-xs text-neutral-500">
            {translate(dictionary, "tierLedger.summary.totalAllocated")}
          </p>
          <p className="text-base font-semibold">
            {formatCurrency(report.totals.totalAllocated)}
          </p>
        </div>
        <div className="rounded border border-neutral-300 p-2">
          <p className="text-xs text-neutral-500">
            {translate(dictionary, "tierLedger.summary.totalDisbursed")}
          </p>
          <p className="text-base font-semibold">
            {formatCurrency(report.totals.totalDisbursed)}
          </p>
        </div>
        <div className="rounded border border-neutral-300 p-2">
          <p className="text-xs text-neutral-500">
            {translate(dictionary, "tierLedger.summary.available")}
          </p>
          <p className="text-base font-semibold">
            {formatCurrency(report.totals.availableBalance)}
          </p>
        </div>
      </section>

      <table className="print-table w-full border-collapse text-xs">
        <thead>
          <tr className="bg-neutral-100">
            <th className="border border-neutral-300 p-1.5 text-start">
              {translate(dictionary, "tierLedger.columns.from")}
            </th>
            <th className="border border-neutral-300 p-1.5 text-start">
              {translate(dictionary, "tierLedger.columns.to")}
            </th>
            <th className="border border-neutral-300 p-1.5 text-end">
              {translate(dictionary, "tierLedger.columns.percentage")}
            </th>
            <th className="border border-neutral-300 p-1.5 text-end">
              {translate(dictionary, "tierLedger.columns.profit")}
            </th>
            <th className="border border-neutral-300 p-1.5 text-end">
              {translate(dictionary, "tierLedger.columns.allocated")}
            </th>
            <th className="border border-neutral-300 p-1.5 text-end">
              {translate(dictionary, "tierLedger.columns.disbursed")}
            </th>
            <th className="border border-neutral-300 p-1.5 text-end">
              {translate(dictionary, "tierLedger.columns.balance")}
            </th>
          </tr>
        </thead>
        <tbody>
          {report.periods.map((p) => (
            <tr key={p.from}>
              <td className="border border-neutral-300 p-1.5">
                {formatDateTime(p.from, locale)}
              </td>
              <td className="border border-neutral-300 p-1.5">
                {p.to
                  ? formatDateTime(p.to, locale)
                  : translate(dictionary, "tierLedger.currentWindow")}
              </td>
              <td className="border border-neutral-300 p-1.5 text-end tabular-nums">
                {p.percentage}%
              </td>
              <td className="border border-neutral-300 p-1.5 text-end tabular-nums">
                {formatCurrency(p.profitInPeriod)}
              </td>
              <td className="border border-neutral-300 p-1.5 text-end tabular-nums">
                {formatCurrency(p.allocatedInPeriod)}
                {p.allocatedInPeriod === 0 && p.profitInPeriod > 0 && (
                  <span className="ms-1 text-[10px] text-neutral-500">
                    ({translate(dictionary, "tierLedger.notActive")})
                  </span>
                )}
              </td>
              <td className="border border-neutral-300 p-1.5 text-end tabular-nums">
                {formatCurrency(p.disbursedInPeriod)}
              </td>
              <td className="border border-neutral-300 p-1.5 text-end tabular-nums font-semibold">
                {formatCurrency(p.runningBalance)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="mt-6 border-t border-neutral-300 pt-3 text-xs text-neutral-500">
        {business?.name} — {formatDateTime(report.generatedAt, locale)}
      </footer>
    </div>
  );
}