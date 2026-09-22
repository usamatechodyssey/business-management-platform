// app/(dashboard)/pos/page.tsx
//
// Server Component. Fetches the active product catalog and the customer
// list in parallel, hands them to POSClient. All checkout logic
// (cart, payment, receipt) is client-side; the sale POST goes through
// /api/sales which is where the transactional work actually runs.

import { getDb } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { getTenantContext, TenantError } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { listCustomers } from "@/lib/customers";
import { POSClient } from "./POSClient";
import type { Product } from "@/types";

export default async function POSPage() {
  const tenant = await getTenantContext();

  if (!hasPermission(tenant.role, "pos.access")) {
    throw new TenantError("You don't have permission to access POS.");
  }

  const locale = await getLocale();
  const dictionary = getDictionary(locale);

  const [products, customers] = await Promise.all([
    getDb().then((db) =>
      db
        .collection<Product>("products")
        .find({ businessId: tenant.businessId, active: true })
        .sort({ name: 1 })
        .toArray()
    ),
    listCustomers(tenant.businessId),
  ]);

  return (
    <POSClient
      products={products}
      customers={customers}
      locale={locale}
      dictionary={dictionary}
    />
  );
}