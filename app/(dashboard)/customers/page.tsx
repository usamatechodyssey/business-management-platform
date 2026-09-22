// app/(dashboard)/customers/page.tsx
//
// Server Component. Fetches customers + the business record (for
// khataSettings) in parallel, hands them to the client CustomersClient.
// Filtering and mutations are handled client-side — customer counts are
// small enough that server-driven pagination isn't warranted here.

import { getTenantContext } from "@/lib/tenant";
import { getDb } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { listCustomers } from "@/lib/customers";
import { CustomersClient } from "./CustomersClient";
import type { Business } from "@/types";

export default async function CustomersPage() {
  const tenant = await getTenantContext();
  const locale = await getLocale();
  const dictionary = getDictionary(locale);

  const [customers, business] = await Promise.all([
    listCustomers(tenant.businessId),
    getDb().then((db) =>
      db
        .collection<Business>("businesses")
        .findOne({ id: tenant.businessId })
    ),
  ]);

  if (!business) {
    // Session is valid but the business doc vanished. Same policy as
    // app/(dashboard)/layout.tsx — fail loudly rather than render a
    // half-configured page.
    throw new Error("Business not found for this session.");
  }

  return (
    <CustomersClient
      customers={customers}
      khataSettings={business.settings.khataSettings}
      businessName={business.name}
      locale={locale}
      dictionary={dictionary}

    />
  );
}