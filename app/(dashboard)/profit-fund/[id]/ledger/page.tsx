// app/(dashboard)/profit-fund/[id]/ledger/page.tsx
//
// Rate period ledger for a single tier. Server Component.

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTenantContext, TenantError } from "@/lib/tenant";
import { getDictionary, translate } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { hasPermission } from "@/lib/permissions";
import { getTierById } from "@/lib/profit-fund";
import { resolveRange } from "@/lib/dashboard";
import { buildTierLedger } from "@/lib/tier-ledger";
import { TierLedgerClient } from "./TierLedgerClient";
import type { RangePreset } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function readString(value: string | string[] | undefined): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

export default async function TierLedgerPage({
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
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/profit-fund"
          className="inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {translate(dictionary, "profitFund.title")}
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {translate(dictionary, "tierLedger.title", { name: tier.name })}
          </h1>
          <p className="text-sm text-text-muted">
            {translate(dictionary, "tierLedger.subtitle")}
          </p>
        </div>
      </div>

      <TierLedgerClient
        report={report}
        rangePreset={range.preset as RangePreset}
        rangeFrom={range.preset === "custom" ? customFrom : undefined}
        rangeTo={range.preset === "custom" ? customTo : undefined}
        locale={locale}
        dictionary={dictionary}
      />
    </div>
  );
}