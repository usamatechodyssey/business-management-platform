// app/api/suppliers/[id]/payments/route.ts
//
// POST — record a payment against a specific purchase (requires
//        "suppliers.manage"). Runs in a MongoDB transaction: purchase
//        amountPaid + paid flag, supplier totalOwed, and the
//        supplierPayments audit row are all applied atomically.
//
// Payments are always tied to a purchase, not just a supplier, so the
// owner gets a per-invoice audit trail and FIFO allocation is
// unnecessary.

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/validate";
import { requireTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { getSupplierById, recordPurchasePayment } from "@/lib/suppliers";

const recordPaymentSchema = z.object({
  purchaseId: z.string().min(1),
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "suppliers.manage")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const { id: supplierId } = await params;

  // Verify supplier exists in this tenant before touching payments so a
  // cross-tenant id returns 404 instead of PURCHASE_NOT_FOUND.
  const supplier = await getSupplierById(tenant.businessId, supplierId);
  if (!supplier) return apiError("Supplier not found.", 404);

  const parsed = await parseJsonBody(req, recordPaymentSchema);
  if (!parsed.success) return parsed.response;
  const { purchaseId, amount, date, note } = parsed.data;

  const result = await recordPurchasePayment({
    businessId: tenant.businessId,
    supplierId,
    purchaseId,
    amount,
    date,
    note,
  });

  if (!result.success) {
    if (result.code === "PURCHASE_NOT_FOUND") {
      return apiError("Purchase not found.", 404);
    }
    // INVALID_AMOUNT — <= 0 or greater than outstanding balance.
    return apiError(
      "Payment amount must be greater than zero and no more than the outstanding balance.",
      422,
      { code: "INVALID_PAYMENT_AMOUNT" }
    );
  }

  return apiSuccess(result, 201);
}