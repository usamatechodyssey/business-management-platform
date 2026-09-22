// app/api/admin/payments/route.ts
//
// GET — paginated list of payments, optional status filter.

import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { listPayments } from "@/lib/payments";
import type { PaymentStatus } from "@/types";

const VALID_STATUSES: PaymentStatus[] = ["pending", "verified", "rejected"];

function parsePage(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.floor(n);
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.success) return guard.response;

  const params = req.nextUrl.searchParams;
  const statusParam = params.get("status");
  const status: PaymentStatus | undefined =
    statusParam && VALID_STATUSES.includes(statusParam as PaymentStatus)
      ? (statusParam as PaymentStatus)
      : undefined;

  const result = await listPayments({
    page: parsePage(params.get("page")),
    status,
  });

  return apiSuccess({
    payments: result.payments,
    pagination: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    },
  });
}