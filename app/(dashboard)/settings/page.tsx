// app/(dashboard)/settings/page.tsx
//
// Server Component. Requires "settings.manage" (owner-only per the
// permissions matrix). Fetches the current business and hands it to the
// client SettingsClient, which owns the tab UI and dispatches to four
// focused forms.

import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { getTenantContext, TenantError } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { getBusinessById } from "@/lib/settings";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const tenant = await getTenantContext();

  if (!hasPermission(tenant.role, "settings.manage")) {
    throw new TenantError("You don't have permission to view settings.");
  }

  const locale = await getLocale();
  const dictionary = getDictionary(locale);

  const business = await getBusinessById(tenant.businessId);
  if (!business) {
    // Session is valid but the business record is missing — same policy
    // as the dashboard layout: fail loudly rather than render a
    // half-configured settings page.
    throw new TenantError("Business not found for this session.");
  }

  return (
    <SettingsClient
      business={business}
      currentLocale={locale}
      dictionary={dictionary}
    />
  );
}