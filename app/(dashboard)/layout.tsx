// app/(dashboard)/layout.tsx
//
// Server layout for the authenticated business app. Blocks the tenant
// when their subscription has lapsed. Billing lives in a separate
// route group (app/(billing)/layout.tsx) so it stays reachable for
// renewal — a single layout cannot conditionally exempt one of its own
// children during client-side navigation.

import type { ReactNode } from "react";
import { getDb } from "@/lib/db";
import { getTenantContext, TenantError } from "@/lib/tenant";
import { getDictionary} from "@/lib/i18n";
import { getImpersonationMarker } from "@/lib/admin-auth";
import { getImpersonationContext } from "@/lib/admin-db";
import { getPlatformSettings } from "@/lib/platform-settings";
import {
  daysUntilExpiry,
  isSubscriptionLapsed,
  lapseReason,
  shouldWarnAboutExpiry,
} from "@/lib/trial";
import { DashboardShell } from "@/app/components/layout/DashboardShell";
import { ImpersonationBanner } from "@/app/components/layout/ImpersonationBanner";
import { SubscriptionBlocked } from "@/app/components/layout/SubscriptionBlocked";
import { TrialWarningBanner } from "@/app/components/layout/TrialWarningBanner";
import type { Business } from "@/types";
import { getLocale } from "@/lib/i18n-server";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const tenant = await getTenantContext();

  const db = await getDb();
  const business = await db
    .collection<Business>("businesses")
    .findOne({ id: tenant.businessId });

  if (!business) {
    throw new TenantError("Business not found for this session.");
  }

  const locale = await getLocale();
  const dictionary = getDictionary(locale);
  const platform = await getPlatformSettings();

  // ── Subscription gating ──────────────────────────────────────
  // Business routes only. /billing is in a different route group and
  // never hits this layout.
  if (isSubscriptionLapsed(business.subscription)) {
    return (
      <SubscriptionBlocked
        variant={lapseReason(business.subscription)}
        reason={business.suspendedReason}
        platform={platform}
        dictionary={dictionary}
      />
    );
  }

  const showWarning =
    platform.trialWarningDays > 0 &&
    shouldWarnAboutExpiry(business.subscription, platform.trialWarningDays);
  const daysLeft = business.subscription
    ? daysUntilExpiry(business.subscription.expiresAt)
    : 0;

  const marker = await getImpersonationMarker();
  const impersonation = marker
    ? await getImpersonationContext(marker)
    : null;

  return (
    <>
      {impersonation && (
        <ImpersonationBanner
          businessName={impersonation.businessName}
          dictionary={dictionary}
        />
      )}
      {showWarning && (
        <TrialWarningBanner
          daysLeft={daysLeft}
          dictionary={dictionary}
        />
      )}
      <DashboardShell
        dictionary={dictionary}
        currentLocale={locale}
        businessName={business.name}
        userName={tenant.name}
        userRole={tenant.role}
        enabledModules={business.enabledModules}
      >
        {children}
      </DashboardShell>
    </>
  );
}