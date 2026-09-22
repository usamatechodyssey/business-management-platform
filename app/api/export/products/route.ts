// app/api/export/products/route.ts
//
// GET — download the tenant's product catalog as CSV. Snapshot (no date
// range). Requires settings.manage.

import { requireTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { apiError } from "@/lib/api-response";
import { exportProducts } from "@/lib/export";
import { buildCsv, csvResponse, slugifyForFilename } from "@/lib/csv";
import { getDb } from "@/lib/db";
import type { Business } from "@/types";

export async function GET() {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "settings.manage")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const db = await getDb();
  const business = await db
    .collection<Business>("businesses")
    .findOne({ id: tenant.businessId }, { projection: { name: 1 } });

  const result = await exportProducts(tenant.businessId);

  const headers = [
    "Name",
    "Code",
    "Category",
    "Unit",
    "Stock",
    "Cost Price",
    "Sell Price",
    "Low Stock Threshold",
    "Status",
  ];

  const csv = buildCsv(
    headers,
    result.rows.map((r) => [
      r.name,
      r.code,
      r.category,
      r.unit,
      r.stockQty,
      r.costPrice,
      r.sellPrice,
      r.lowStockThreshold,
      r.status,
    ])
  );

  const slug = slugifyForFilename(business?.name ?? "business");
  const filename = `${slug}-products-${new Date().toISOString().slice(0, 10)}.csv`;

  return csvResponse(csv, filename);
}