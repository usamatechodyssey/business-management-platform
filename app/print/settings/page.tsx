// app/print/settings/page.tsx
//
// Print-ready single-page view of every dataset. Lives outside the
// (dashboard) route group, so no shell chrome renders here — only the
// content and the print CSS. Users land here from Settings → Export
// → "Open print view".

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDb } from "@/lib/db";
import { getTenantContext, TenantError } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import {
  getDictionary,
  translate,
  type TranslationKey,
} from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { formatCurrency, formatDate } from "@/lib/format";
import { resolveRange } from "@/lib/dashboard";
import {
  exportCustomers,
  exportLedger,
  exportProducts,
  exportSales,
  exportSuppliers,
} from "@/lib/export";
import { PrintButton } from "@/app/components/settings/PrintButton";
import type { Business, RangePreset } from "@/types";

interface PrintPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function readString(value: string | string[] | undefined): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

function rangeLabelKey(preset: RangePreset): TranslationKey {
  switch (preset) {
    case "today":
      return "dashboard.ranges.today";
    case "week":
      return "dashboard.ranges.week";
    case "month":
      return "dashboard.ranges.month";
    case "quarter":
      return "dashboard.ranges.quarter";
    case "halfYear":
      return "dashboard.ranges.halfYear";
    case "year":
      return "dashboard.ranges.year";
    case "custom":
      return "dashboard.ranges.custom";
  }
}

export default async function PrintPage({ searchParams }: PrintPageProps) {
  const tenant = await getTenantContext();

  if (!hasPermission(tenant.role, "settings.manage")) {
    throw new TenantError("You don't have permission to view this page.");
  }

  const params = await searchParams;
  const preset = readString(params.range) || undefined;
  const customFrom = readString(params.from) || undefined;
  const customTo = readString(params.to) || undefined;

  const locale = await getLocale();
  const dictionary = getDictionary(locale);
  const range = resolveRange(preset, customFrom, customTo);

  const db = await getDb();
  const [business, products, customers, suppliers, sales, ledger] =
    await Promise.all([
      db.collection<Business>("businesses").findOne({ id: tenant.businessId }),
      exportProducts(tenant.businessId),
      exportCustomers(tenant.businessId),
      exportSuppliers(tenant.businessId),
      exportSales(tenant.businessId, range.preset, customFrom, customTo),
      exportLedger(tenant.businessId, range.preset, customFrom, customTo),
    ]);

  if (!business) {
    throw new TenantError("Business not found.");
  }

  const generatedAt = new Date().toISOString();
  const noData = translate(dictionary, "exportPrint.noData");

  return (
    <div className="print-content mx-auto max-w-5xl bg-white p-4 text-black sm:p-8">
      {/* On-screen controls (hidden when printing) */}
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {translate(dictionary, "exportPrint.backToSettings")}
        </Link>
        <PrintButton
          label={translate(dictionary, "exportPrint.printButton")}
        />
      </div>

      {/* Header block */}
      <header className="mb-6 border-b-2 border-neutral-800 pb-3">
        <h1 className="text-2xl font-bold">{business.name}</h1>
        <p className="mt-1 text-sm text-neutral-700">
          {business.ownerName} · {business.phone}
          {business.address ? ` · ${business.address}` : ""}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          {translate(dictionary, "exportPrint.generated")}:{" "}
          {formatDate(generatedAt, locale)}
          {" · "}
          {translate(dictionary, "exportPrint.rangeLabel")}:{" "}
          {translate(dictionary, rangeLabelKey(range.preset))}
        </p>
      </header>

      {/* Products */}
      <section className="print-section mb-8">
        <h2 className="mb-2 border-b border-neutral-300 pb-1 text-lg font-semibold">
          {translate(dictionary, "exportPrint.products")}
          <span className="ms-2 text-sm font-normal text-neutral-500">
            ({products.rows.length})
          </span>
        </h2>
        {products.rows.length === 0 ? (
          <p className="text-sm text-neutral-500">{noData}</p>
        ) : (
          <table className="print-table w-full border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-100">
                <th className="border border-neutral-300 p-1.5 text-start">
                  Name
                </th>
                <th className="border border-neutral-300 p-1.5 text-start">
                  Code
                </th>
                <th className="border border-neutral-300 p-1.5 text-start">
                  Category
                </th>
                <th className="border border-neutral-300 p-1.5 text-end">
                  Stock
                </th>
                <th className="border border-neutral-300 p-1.5 text-end">
                  Cost
                </th>
                <th className="border border-neutral-300 p-1.5 text-end">
                  Sell
                </th>
                <th className="border border-neutral-300 p-1.5 text-start">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {products.rows.map((p) => (
                <tr key={p.code}>
                  <td className="border border-neutral-300 p-1.5">{p.name}</td>
                  <td className="border border-neutral-300 p-1.5 font-mono">
                    {p.code}
                  </td>
                  <td className="border border-neutral-300 p-1.5">
                    {p.category}
                  </td>
                  <td className="border border-neutral-300 p-1.5 text-end tabular-nums">
                    {p.stockQty}
                  </td>
                  <td className="border border-neutral-300 p-1.5 text-end tabular-nums">
                    {formatCurrency(p.costPrice)}
                  </td>
                  <td className="border border-neutral-300 p-1.5 text-end tabular-nums">
                    {formatCurrency(p.sellPrice)}
                  </td>
                  <td className="border border-neutral-300 p-1.5">
                    {p.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Customers */}
      <section className="print-section mb-8">
        <h2 className="mb-2 border-b border-neutral-300 pb-1 text-lg font-semibold">
          {translate(dictionary, "exportPrint.customers")}
          <span className="ms-2 text-sm font-normal text-neutral-500">
            ({customers.rows.length})
          </span>
        </h2>
        {customers.rows.length === 0 ? (
          <p className="text-sm text-neutral-500">{noData}</p>
        ) : (
          <table className="print-table w-full border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-100">
                <th className="border border-neutral-300 p-1.5 text-start">
                  Name
                </th>
                <th className="border border-neutral-300 p-1.5 text-start">
                  Phone
                </th>
                <th className="border border-neutral-300 p-1.5 text-start">
                  Tag
                </th>
                <th className="border border-neutral-300 p-1.5 text-end">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody>
              {customers.rows.map((c) => (
                <tr key={c.phone}>
                  <td className="border border-neutral-300 p-1.5">{c.name}</td>
                  <td className="border border-neutral-300 p-1.5">{c.phone}</td>
                  <td className="border border-neutral-300 p-1.5">{c.tag}</td>
                  <td className="border border-neutral-300 p-1.5 text-end tabular-nums">
                    {formatCurrency(c.totalDue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Suppliers */}
      <section className="print-section mb-8">
        <h2 className="mb-2 border-b border-neutral-300 pb-1 text-lg font-semibold">
          {translate(dictionary, "exportPrint.suppliers")}
          <span className="ms-2 text-sm font-normal text-neutral-500">
            ({suppliers.rows.length})
          </span>
        </h2>
        {suppliers.rows.length === 0 ? (
          <p className="text-sm text-neutral-500">{noData}</p>
        ) : (
          <table className="print-table w-full border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-100">
                <th className="border border-neutral-300 p-1.5 text-start">
                  Name
                </th>
                <th className="border border-neutral-300 p-1.5 text-start">
                  Phone
                </th>
                <th className="border border-neutral-300 p-1.5 text-start">
                  Contact
                </th>
                <th className="border border-neutral-300 p-1.5 text-end">
                  Owed
                </th>
              </tr>
            </thead>
            <tbody>
              {suppliers.rows.map((s) => (
                <tr key={s.phone}>
                  <td className="border border-neutral-300 p-1.5">{s.name}</td>
                  <td className="border border-neutral-300 p-1.5">{s.phone}</td>
                  <td className="border border-neutral-300 p-1.5">
                    {s.contactPerson}
                  </td>
                  <td className="border border-neutral-300 p-1.5 text-end tabular-nums">
                    {formatCurrency(s.totalOwed)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Sales */}
      <section className="print-section mb-8">
        <h2 className="mb-2 border-b border-neutral-300 pb-1 text-lg font-semibold">
          {translate(dictionary, "exportPrint.sales")}
          <span className="ms-2 text-sm font-normal text-neutral-500">
            ({sales.rows.length})
          </span>
        </h2>
        {sales.rows.length === 0 ? (
          <p className="text-sm text-neutral-500">{noData}</p>
        ) : (
          <table className="print-table w-full border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-100">
                <th className="border border-neutral-300 p-1.5 text-start">
                  Date
                </th>
                <th className="border border-neutral-300 p-1.5 text-start">
                  Customer
                </th>
                <th className="border border-neutral-300 p-1.5 text-start">
                  Method
                </th>
                <th className="border border-neutral-300 p-1.5 text-end">
                  Total
                </th>
                <th className="border border-neutral-300 p-1.5 text-end">
                  Paid
                </th>
                <th className="border border-neutral-300 p-1.5 text-end">
                  Due
                </th>
                <th className="border border-neutral-300 p-1.5 text-end">
                  Profit
                </th>
              </tr>
            </thead>
            <tbody>
              {sales.rows.map((s) => (
                <tr key={s.saleId}>
                  <td className="border border-neutral-300 p-1.5">
                    {s.date}
                  </td>
                  <td className="border border-neutral-300 p-1.5">
                    {s.customer}
                  </td>
                  <td className="border border-neutral-300 p-1.5">
                    {s.paymentMethod}
                  </td>
                  <td className="border border-neutral-300 p-1.5 text-end tabular-nums">
                    {formatCurrency(s.total)}
                  </td>
                  <td className="border border-neutral-300 p-1.5 text-end tabular-nums">
                    {formatCurrency(s.amountPaid)}
                  </td>
                  <td className="border border-neutral-300 p-1.5 text-end tabular-nums">
                    {formatCurrency(s.amountDue)}
                  </td>
                  <td className="border border-neutral-300 p-1.5 text-end tabular-nums">
                    {formatCurrency(s.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Ledger */}
      <section className="print-section mb-8">
        <h2 className="mb-2 border-b border-neutral-300 pb-1 text-lg font-semibold">
          {translate(dictionary, "exportPrint.ledger")}
          <span className="ms-2 text-sm font-normal text-neutral-500">
            ({ledger.rows.length})
          </span>
        </h2>
        {ledger.rows.length === 0 ? (
          <p className="text-sm text-neutral-500">{noData}</p>
        ) : (
          <table className="print-table w-full border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-100">
                <th className="border border-neutral-300 p-1.5 text-start">
                  Date
                </th>
                <th className="border border-neutral-300 p-1.5 text-start">
                  Customer
                </th>
                <th className="border border-neutral-300 p-1.5 text-start">
                  Type
                </th>
                <th className="border border-neutral-300 p-1.5 text-end">
                  Amount
                </th>
                <th className="border border-neutral-300 p-1.5 text-start">
                  Note
                </th>
                <th className="border border-neutral-300 p-1.5 text-end">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody>
              {ledger.rows.map((e, idx) => (
                <tr key={`${e.date}-${e.customerName}-${idx}`}>
                  <td className="border border-neutral-300 p-1.5">
                    {e.date}
                  </td>
                  <td className="border border-neutral-300 p-1.5">
                    {e.customerName}
                  </td>
                  <td className="border border-neutral-300 p-1.5">
                    {e.type}
                  </td>
                  <td className="border border-neutral-300 p-1.5 text-end tabular-nums">
                    {formatCurrency(e.amount)}
                  </td>
                  <td className="border border-neutral-300 p-1.5">
                    {e.note}
                  </td>
                  <td className="border border-neutral-300 p-1.5 text-end tabular-nums">
                    {formatCurrency(e.balanceAfter)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className="mt-8 border-t border-neutral-300 pt-3 text-xs text-neutral-500">
        {business.name} — {translate(dictionary, "exportPrint.generated")}:{" "}
        {formatDate(generatedAt, locale)}
      </footer>
    </div>
  );
}