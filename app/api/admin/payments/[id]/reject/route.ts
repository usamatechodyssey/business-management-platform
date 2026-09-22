// app/api/admin/payments/[id]/reject/route.ts

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/validate";
import { requireAdmin } from "@/lib/admin-auth";
import { rejectPayment } from "@/lib/payments";
import { writeAdminAction } from "@/lib/admin-db";

const rejectSchema = z.object({
  reason: z.string().trim().min(1).max(200),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.success) return guard.response;
  const { admin } = guard;

  const { id } = await params;
  const parsed = await parseJsonBody(req, rejectSchema);
  if (!parsed.success) return parsed.response;

  const result = await rejectPayment(id, admin.adminId, parsed.data.reason);
  if (!result.success) {
    if (result.code === "NOT_FOUND") {
      return apiError("Payment not found.", 404);
    }
    return apiError("This payment was already processed.", 409, {
      code: "ALREADY_PROCESSED",
    });
  }

await writeAdminAction({
  adminId: admin.adminId,
  adminName: admin.name,
  type: "payment.reject",
  targetBusinessId: result.payment.businessId,
  targetBusinessName: result.payment.businessName,
  metadata: {
    reference: result.payment.reference,
    reason: parsed.data.reason,
  },
});

  return apiSuccess({ payment: result.payment });
}