// app/(dashboard)/reports/page.tsx
//
// Server Component. Parses the range params, resolves them (same resolver
// as dashboard/profit-fund), assembles the report, and hands it to the
// client ReportsClient. No mutations here — reports are read-only.

import { getTenantContext, TenantError } from "@/lib/tenant";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { hasPermission } from "@/lib/permissions";
import { resolveRange } from "@/lib/dashboard";
import { getReportSummary } from "@/lib/reports";
import { ReportsClient } from "./ReportsClient";
import type { RangePreset } from "@/types";

interface ReportsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function readString(value: string | string[] | undefined): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

export default async function ReportsPage({
  searchParams,
}: ReportsPageProps) {
  const tenant = await getTenantContext();

  if (!hasPermission(tenant.role, "reports.view")) {
    throw new TenantError("You don't have permission to view reports.");
  }

  const params = await searchParams;
  const preset = readString(params.range) || undefined;
  const customFrom = readString(params.from) || undefined;
  const customTo = readString(params.to) || undefined;

  const locale = await getLocale();
  const dictionary = getDictionary(locale);

  const range = resolveRange(preset, customFrom, customTo);
  const summary = await getReportSummary(tenant.businessId, range);

  return (
    <ReportsClient
      summary={summary}
      rangePreset={range.preset as RangePreset}
      rangeFrom={range.preset === "custom" ? customFrom : undefined}
      rangeTo={range.preset === "custom" ? customTo : undefined}
      locale={locale}
      dictionary={dictionary}
    />
  );
}