// app/api/export/ledger/route.ts
//
// GET ?range=month  or  ?range=custom&from=YYYY-MM-DD&to=YYYY-MM-DD
// Downloads the tenant's khata ledger for the resolved range as CSV.

import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { apiError } from "@/lib/api-response";
import { exportLedger } from "@/lib/export";
import { buildCsv, csvResponse, slugifyForFilename } from "@/lib/csv";
import { getDb } from "@/lib/db";
import type { Business } from "@/types";

export async function GET(req: NextRequest) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "settings.manage")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const params = req.nextUrl.searchParams;
  const preset = params.get("range")?.trim() || undefined;
  const from = params.get("from")?.trim() || undefined;
  const to = params.get("to")?.trim() || undefined;

  const db = await getDb();
  const business = await db
    .collection<Business>("businesses")
    .findOne({ id: tenant.businessId }, { projection: { name: 1 } });

  const result = await exportLedger(tenant.businessId, preset, from, to);

  const headers = [
    "Date",
    "Customer",
    "Type",
    "Amount",
    "Note",
    "Balance After",
  ];

  const csv = buildCsv(
    headers,
    result.rows.map((r) => [
      r.date,
      r.customerName,
      r.type,
      r.amount,
      r.note,
      r.balanceAfter,
    ])
  );

  const slug = slugifyForFilename(business?.name ?? "business");
  const filename = `${slug}-ledger-${new Date().toISOString().slice(0, 10)}.csv`;

  return csvResponse(csv, filename);
}