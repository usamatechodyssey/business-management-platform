// app/api/purchases/[id]/route.ts
//
// GET    — read a purchase (requires "suppliers.view")
// DELETE — delete a purchase, only when no payments have been recorded
//          against it (requires "suppliers.manage"). Runs in a MongoDB
//          transaction: stock is reversed and supplier owed is reduced.
//          Cost price is intentionally not restored (see lib/suppliers.ts).

import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { requireTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { deletePurchase, getPurchaseById } from "@/lib/suppliers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "suppliers.view")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const { id } = await params;
  const purchase = await getPurchaseById(tenant.businessId, id);
  if (!purchase) return apiError("Purchase not found.", 404);

  return apiSuccess(purchase);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "suppliers.manage")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const { id } = await params;
  const result = await deletePurchase(tenant.businessId, id);

  if (!result.success) {
    if (result.code === "NOT_FOUND") {
      return apiError("Purchase not found.", 404);
    }
    // HAS_PAYMENTS — refuse, because reversing a paid purchase would
    // require knowing which rupees to un-pay.
    return apiError(
      "This purchase has recorded payments and cannot be deleted.",
      409,
      { code: "PURCHASE_HAS_PAYMENTS" }
    );
  }

  return apiSuccess({ deleted: true });
}