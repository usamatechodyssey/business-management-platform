// app/(dashboard)/suppliers/page.tsx
//
// Server Component. Fetches the supplier list and all active products in
// parallel, hands them to the client SuppliersClient. All filtering and
// mutations are handled client-side — supplier counts are small enough
// that server-driven pagination would be overkill here.

import { getTenantContext } from "@/lib/tenant";
import { getDb } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { listSuppliers } from "@/lib/suppliers";
import { SuppliersClient } from "./SuppliersClient";
import type { Product } from "@/types";

export default async function SuppliersPage() {
  const tenant = await getTenantContext();
  const locale = await getLocale();
  const dictionary = getDictionary(locale);

  const [suppliers, products] = await Promise.all([
    listSuppliers(tenant.businessId),
    getDb().then((db) =>
      db
        .collection<Product>("products")
        .find(
          { businessId: tenant.businessId, active: true },
          {
            projection: {
              id: 1,
              name: 1,
              code: 1,
              category: 1,
              unit: 1,
              stockQty: 1,
              costPrice: 1,
              sellPrice: 1,
              lowStockThreshold: 1,
              active: 1,
              businessId: 1,
            },
          }
        )
        .sort({ name: 1 })
        .toArray()
    ),
  ]);

  return (
    <SuppliersClient
      suppliers={suppliers}
      products={products}
      dictionary={dictionary}
    />
  );
}