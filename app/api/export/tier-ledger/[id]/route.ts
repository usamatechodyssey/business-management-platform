// app/api/export/tier-ledger/[id]/route.ts
//
// GET ?range=month  or  ?range=custom&from=...&to=...
// Downloads the tier ledger as CSV.
//
// Column headers are translated to the user's current locale (read from
// the `locale` cookie). Data values themselves — tier names, business
// names — are user-entered and stay as-is regardless of locale.

import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { apiError } from "@/lib/api-response";
import { getTierById } from "@/lib/profit-fund";
import { resolveRange } from "@/lib/dashboard";
import { buildTierLedger } from "@/lib/tier-ledger";
import { buildCsv, csvResponse, slugifyForFilename } from "@/lib/csv";
import { getDb } from "@/lib/db";
import { getDictionary, translate } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { formatDateTime } from "@/lib/format";
import type { Business } from "@/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "settings.manage")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const { id } = await params;

  const tier = await getTierById(tenant.businessId, id);
  if (!tier) return apiError("Tier not found.", 404);

  const search = req.nextUrl.searchParams;
  const preset = search.get("range")?.trim() || undefined;
  const from = search.get("from")?.trim() || undefined;
  const to = search.get("to")?.trim() || undefined;

  const range = resolveRange(preset, from, to);

  const [db, locale] = await Promise.all([getDb(), getLocale()]);
  const dictionary = getDictionary(locale);

  const business = await db
    .collection<Business>("businesses")
    .findOne({ id: tenant.businessId }, { projection: { name: 1 } });

  const report = await buildTierLedger(
    tenant.businessId,
    tier,
    range.from.slice(0, 10),
    range.to.slice(0, 10)
  );

  const headers = [
    translate(dictionary, "tierLedger.columns.from"),
    translate(dictionary, "tierLedger.columns.to"),
    translate(dictionary, "tierLedger.columns.percentage"),
    translate(dictionary, "tierLedger.columns.profit"),
    translate(dictionary, "tierLedger.columns.allocated"),
    translate(dictionary, "tierLedger.columns.disbursed"),
    translate(dictionary, "tierLedger.columns.balance"),
  ];

  const currentLabel = translate(dictionary, "tierLedger.currentWindow");
  const totalLabel = translate(dictionary, "tierLedger.totalRow");

  const rows = report.periods.map((p) => [
    formatDateTime(p.from, locale),
    p.to ? formatDateTime(p.to, locale) : currentLabel,
    `${p.percentage}%`,
    p.profitInPeriod,
    p.allocatedInPeriod,
    p.disbursedInPeriod,
    p.runningBalance,
  ]);

  // Totals row — keep numbers formatted as plain values so Excel still
  // sums them if the user extends the sheet.
  rows.push([
    totalLabel,
    "",
    "",
    report.totals.totalProfit,
    report.totals.totalAllocated,
    report.totals.totalDisbursed,
    report.totals.availableBalance,
  ]);

  const csv = buildCsv(headers, rows);
  const slug = slugifyForFilename(business?.name ?? "business");
  const tierSlug = slugifyForFilename(tier.name);
  const filename = `${slug}-${tierSlug}-ledger-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  return csvResponse(csv, filename);
}