// app/api/suppliers/[id]/purchases/route.ts
//
// GET  — list purchases for a supplier, newest first (requires
//        "suppliers.view").
// POST — record a purchase against this supplier (requires
//        "suppliers.manage"). Runs inside a MongoDB transaction: stock,
//        cost price, supplier owed total, and initial payment are all
//        applied atomically (see lib/suppliers.ts → createPurchase).
//
// Tenant isolation: supplier must belong to the caller's business before
// any list or write runs; a cross-tenant id returns 404.

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/validate";
import { requireTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import {
  createPurchase,
  getSupplierById,
  listPurchasesForSupplier,
} from "@/lib/suppliers";

const purchaseItemSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int().positive(),
  cost: z.number().min(0),
});

const createPurchaseSchema = z.object({
  items: z.array(purchaseItemSchema).min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  initialPayment: z.number().min(0),
  invoiceNo: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed === "" ? undefined : trimmed;
    },
    z.string().max(50).optional()
  ),
});

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

  const supplier = await getSupplierById(tenant.businessId, id);
  if (!supplier) return apiError("Supplier not found.", 404);

  const purchases = await listPurchasesForSupplier(tenant.businessId, id);
  return apiSuccess({ purchases });
}

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

  const parsed = await parseJsonBody(req, createPurchaseSchema);
  if (!parsed.success) return parsed.response;
  const { items, date, initialPayment, invoiceNo } = parsed.data;

  const result = await createPurchase({
    businessId: tenant.businessId,
    supplierId,
    items,
    date,
    initialPayment,
    invoiceNo,
  });

  if (!result.success) {
    if (result.code === "SUPPLIER_NOT_FOUND") {
      return apiError("Supplier not found.", 404);
    }
    if (result.code === "PRODUCT_NOT_FOUND") {
      return apiError("One or more products could not be found.", 404, {
        code: "PRODUCT_NOT_FOUND",
      });
    }
    // INVALID_PAYMENT — initial payment exceeds total cost.
    return apiError("Initial payment exceeds the purchase total.", 422, {
      code: "INVALID_PAYMENT",
    });
  }

  return apiSuccess(result.purchase, 201);
}