// app/api/sales/[id]/route.ts
//
// GET    — read a sale by id (requires "pos.access")
// DELETE — reverse a sale. Only cash and online sales can be deleted;
//          khata/partial sales carry a customer balance and would need a
//          proper return/refund flow to reverse safely (not v1). Reversal
//          restores stock and runs in a MongoDB transaction.
//
// Tenant isolation: every query is scoped by businessId; a cross-tenant
// id returns 404, never 403.

import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { requireTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { deleteSale, getSaleById } from "@/lib/sales";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "pos.access")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const { id } = await params;
  const sale = await getSaleById(tenant.businessId, id);
  if (!sale) return apiError("Sale not found.", 404);

  return apiSuccess(sale);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "pos.access")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const { id } = await params;
  const result = await deleteSale(tenant.businessId, id);

  if (!result.success) {
    if (result.code === "NOT_FOUND") {
      return apiError("Sale not found.", 404);
    }
    // HAS_KHATA_BALANCE — a credit sale can't be deleted; reversing it
    // would require un-applying any later payments against the customer's
    // khata. Returns/refunds for credit sales are a future flow.
    return apiError(
      "Credit sales cannot be deleted. Record an offsetting payment instead.",
      409,
      { code: "SALE_HAS_KHATA_BALANCE" }
    );
  }

  return apiSuccess({ deleted: true });
}