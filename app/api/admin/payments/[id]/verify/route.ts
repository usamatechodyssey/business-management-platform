// app/api/admin/payments/[id]/verify/route.ts
//
// Marks a payment verified and extends the tenant's subscription in one
// transaction. Writes an admin audit log entry.

import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { verifyPayment } from "@/lib/payments";
import { writeAdminAction } from "@/lib/admin-db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.success) return guard.response;
  const { admin } = guard;

  const { id } = await params;
  const result = await verifyPayment(id, admin.adminId);

  if (!result.success) {
    if (result.code === "NOT_FOUND") {
      return apiError("Payment not found.", 404);
    }
    if (result.code === "ALREADY_PROCESSED") {
      return apiError("This payment was already processed.", 409, {
        code: "ALREADY_PROCESSED",
      });
    }
    return apiError("Business not found for this payment.", 404);
  }

  await writeAdminAction({
  adminId: admin.adminId,
  adminName: admin.name,
  type: "payment.verify",
  targetBusinessId: result.payment.businessId,
  targetBusinessName: result.payment.businessName,
  metadata: {
    reference: result.payment.reference,
    plan: result.payment.plan,
    months: result.payment.months,
    amount: result.payment.amount,
  },
});

  return apiSuccess({
    payment: result.payment,
    business: result.business,
  });
}