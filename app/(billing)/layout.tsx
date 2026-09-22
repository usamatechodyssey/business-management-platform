// app/(billing)/layout.tsx
//
// Layout for the billing route group. Same shell as (dashboard) but
// without the subscription-lapse block, and with the sidebar/nav
// "restricted to billing" flag set so a lapsed customer can still
// reach Billing but isn't repeatedly bounced from other clicks.

import type { ReactNode } from "react";
import { getDb } from "@/lib/db";
import { getTenantContext, TenantError } from "@/lib/tenant";
import { getDictionary} from "@/lib/i18n";
import { getImpersonationMarker } from "@/lib/admin-auth";
import { getImpersonationContext } from "@/lib/admin-db";
import { isSubscriptionLapsed } from "@/lib/trial";
import { DashboardShell } from "@/app/components/layout/DashboardShell";
import { ImpersonationBanner } from "@/app/components/layout/ImpersonationBanner";
import type { Business } from "@/types";
import { getLocale } from "@/lib/i18n-server";

export default async function BillingLayout({
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
  const restrictedToBilling = isSubscriptionLapsed(business.subscription);

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
      <DashboardShell
        dictionary={dictionary}
        currentLocale={locale}
        businessName={business.name}
        userName={tenant.name}
        userRole={tenant.role}
        enabledModules={business.enabledModules}
        restrictedToBilling={restrictedToBilling}
      >
        {children}
      </DashboardShell>
    </>
  );
}