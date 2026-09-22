// app/api/admin/actions/route.ts

import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { listAdminActions } from "@/lib/admin-db";

function parsePage(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.floor(n);
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.success) return guard.response;

  const page = parsePage(req.nextUrl.searchParams.get("page"));
  const result = await listAdminActions(page);

  return apiSuccess({
    actions: result.actions,
    pagination: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    },
  });
}