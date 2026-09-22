// app/api/profit-fund-tiers/[id]/disbursements/route.ts
//
// GET  — list disbursements for a tier, newest first (requires
//        "profitFund.view")
// POST — record a disbursement against the tier (requires
//        "profitFund.manage"). Validates against the tier's current
//        available balance (lifetime allocation − lifetime disbursed).
//
// Tenant isolation: tier must belong to the caller's business before any
// read/write runs; a cross-tenant id returns 404.

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/validate";
import { requireTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import {
  getTierById,
  listDisbursementsForTier,
  recordDisbursement,
} from "@/lib/profit-fund";

const recordDisbursementSchema = z.object({
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed === "" ? undefined : trimmed;
    },
    z.string().max(200).optional()
  ),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "profitFund.view")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const { id } = await params;

  const tier = await getTierById(tenant.businessId, id);
  if (!tier) return apiError("Tier not found.", 404);

  const disbursements = await listDisbursementsForTier(
    tenant.businessId,
    id
  );
  return apiSuccess({ tier, disbursements });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "profitFund.manage")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const { id: tierId } = await params;

  // Verify tier exists before running the balance check so a foreign id
  // returns a clean 404, not a balance error.
  const tier = await getTierById(tenant.businessId, tierId);
  if (!tier) return apiError("Tier not found.", 404);

  const parsed = await parseJsonBody(req, recordDisbursementSchema);
  if (!parsed.success) return parsed.response;
  const { amount, date, note } = parsed.data;

  const result = await recordDisbursement({
    businessId: tenant.businessId,
    tierId,
    amount,
    date,
    note,
  });

  if (!result.success) {
    if (result.code === "TIER_NOT_FOUND") {
      return apiError("Tier not found.", 404);
    }
    if (result.code === "TIER_DISABLED") {
      return apiError("This tier is disabled.", 422, {
        code: "TIER_DISABLED",
      });
    }
    if (result.code === "INVALID_AMOUNT") {
      return apiError("Amount must be greater than zero.", 422, {
        code: "INVALID_AMOUNT",
      });
    }
    // INSUFFICIENT_BALANCE — amount exceeds available fund.
    return apiError(
      "Amount exceeds the tier's available balance.",
      422,
      {
        code: "INSUFFICIENT_BALANCE",
        fields: result.available !== undefined
          ? { available: String(result.available) }
          : undefined,
      }
    );
  }

  return apiSuccess({ disbursement: result.disbursement }, 201);
}