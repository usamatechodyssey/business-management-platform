// app/(dashboard)/billing/page.tsx
//
// Owner-facing billing page. Shows current subscription + payment
// history, and lets the owner submit a new payment for admin review.

import { getTenantContext, TenantError } from "@/lib/tenant";
import { getDb } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { hasPermission } from "@/lib/permissions";
import { listPayments } from "@/lib/payments";
import { listActivePlans } from "@/lib/plans";
import { getPlatformPaymentInfo } from "@/lib/platform-info";
import { BillingClient } from "./BillingClient";
import type { Business } from "@/types";

export default async function BillingPage() {
  const tenant = await getTenantContext();

  if (!hasPermission(tenant.role, "settings.manage")) {
    throw new TenantError("You don't have permission to view billing.");
  }

  const locale = await getLocale();
  const dictionary = getDictionary(locale);

  const db = await getDb();
  const [business, paymentsResult, plans] = await Promise.all([
    db
      .collection<Business>("businesses")
      .findOne({ id: tenant.businessId }),
    listPayments({ businessId: tenant.businessId, page: 1 }),
    listActivePlans(),
  ]);

  if (!business) {
    throw new TenantError("Business not found for this session.");
  }

  const platformInfo = getPlatformPaymentInfo();
  const platformWhatsAppNumber = process.env.PLATFORM_WHATSAPP_NUMBER ?? "";

  return (
    <BillingClient
      business={business}
      payments={paymentsResult.payments}
      plans={plans}
      platformInfo={platformInfo}
      platformWhatsAppNumber={platformWhatsAppNumber}
      locale={locale}
      dictionary={dictionary}
    />
  );
}