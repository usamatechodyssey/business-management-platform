// app/(dashboard)/layout.tsx
//
// Server layout for the authenticated app shell. Owns all data fetching
// (session, tenant Business record, locale dictionary, filtered nav items)
// and hands it to the client DashboardShell, which owns drawer + user-menu
// state and the logout flow. Client code never touches cookies or the DB.

import type { ReactNode } from "react";
import { getDb } from "@/lib/db";
import { getTenantContext, TenantError } from "@/lib/tenant";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { DashboardShell } from "@/app/components/layout/DashboardShell";
import { getVisibleNavItems } from "@/app/components/layout/nav-items";
import type { Business } from "@/types";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Throws TenantError if unauthenticated or the session has no businessId.
  // Both cases bubble up to app/(dashboard)/error.tsx (F9).
  const tenant = await getTenantContext();

  const db = await getDb();
  const business = await db
    .collection<Business>("businesses")
    .findOne({ id: tenant.businessId });

  if (!business) {
    // Session is valid but the tenant's Business doc is gone (deleted,
    // wrong DB, corrupted JWT). Fail loudly rather than render a broken
    // shell with an empty name and no modules.
    throw new TenantError("Business not found for this session.");
  }

  const locale = await getLocale();
  const dictionary = getDictionary(locale);
  const items = getVisibleNavItems(business.enabledModules, tenant.role);

  return (
    <DashboardShell
      dictionary={dictionary}
      currentLocale={locale}
      businessName={business.name}
      userName={tenant.name}
      userRole={tenant.role}
      items={items}
    >
      {children}
    </DashboardShell>
  );
}