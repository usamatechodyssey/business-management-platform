// app/(dashboard)/profit-fund/page.tsx
//
// Server Component. Resolves the requested time range (same presets as
// the dashboard), computes the tier breakdown, and hands everything to
// the client ProfitFundClient. All mutations (create/edit/toggle/delete
// tiers, record disbursements) go through the profit-fund API routes.

import { getTenantContext, TenantError } from "@/lib/tenant";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { hasPermission } from "@/lib/permissions";
import { resolveRange } from "@/lib/dashboard";
import { getProfitFundSummary } from "@/lib/profit-fund";
import { ProfitFundClient } from "./ProfitFundClient";
import type { RangePreset } from "@/types";

interface ProfitFundPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function readString(value: string | string[] | undefined): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

export default async function ProfitFundPage({
  searchParams,
}: ProfitFundPageProps) {
  const tenant = await getTenantContext();

  if (!hasPermission(tenant.role, "profitFund.view")) {
    throw new TenantError("You don't have permission to view the profit fund.");
  }

  const params = await searchParams;
  const preset = readString(params.range) || undefined;
  const customFrom = readString(params.from) || undefined;
  const customTo = readString(params.to) || undefined;

  const locale = await getLocale();
  const dictionary = getDictionary(locale);

  const range = resolveRange(preset, customFrom, customTo);
  const summary = await getProfitFundSummary(tenant.businessId, range);

  return (
    <ProfitFundClient
      summary={summary}
      rangePreset={range.preset as RangePreset}
      rangeFrom={range.preset === "custom" ? customFrom : undefined}
      rangeTo={range.preset === "custom" ? customTo : undefined}
      locale={locale}
      dictionary={dictionary}
    />
  );
}