// app/api/export/customers/route.ts

import { requireTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { apiError } from "@/lib/api-response";
import { exportCustomers } from "@/lib/export";
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

  const result = await exportCustomers(tenant.businessId);

  const headers = [
    "Name",
    "Phone",
    "Address",
    "Tag",
    "Credit Limit",
    "Due Date",
    "Guarantor Name",
    "Guarantor Phone",
    "Current Balance",
    "Notes",
    "Created At",
  ];

  const csv = buildCsv(
    headers,
    result.rows.map((r) => [
      r.name,
      r.phone,
      r.address,
      r.tag,
      r.creditLimit,
      r.dueDate,
      r.guarantorName,
      r.guarantorPhone,
      r.totalDue,
      r.notes,
      r.createdAt,
    ])
  );

  const slug = slugifyForFilename(business?.name ?? "business");
  const filename = `${slug}-customers-${new Date().toISOString().slice(0, 10)}.csv`;

  return csvResponse(csv, filename);
}