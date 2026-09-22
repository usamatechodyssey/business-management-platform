// app/api/sales/route.ts
//
// GET  — paginated sales list with optional date range / customer / query
//        filters. Requires "pos.access".
// POST — record a sale (transactional). Requires "pos.access".
//
// Field-level validation lives client-side (POS cart/payment panel) with
// the user's locale; server-side Zod is a security backstop. Business-rule
// failures (insufficient stock, credit limit exceeded, invalid payment,
// monthly sales limit hit) return translatable `code` values, never raw
// server strings.

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/validate";
import { requireTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { checkResourceLimit } from "@/lib/limits";
import { requireActiveTenant } from "@/lib/subscription-guard";
import {
  createSale,
  listSales,
  type CreateSaleErrorCode,
  type CreateSaleResult,
} from "@/lib/sales";




function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.floor(n);
}

const saleItemSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int().positive(),
  price: z.number().min(0),
});

const createSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1),
  customerId: z
    .preprocess(
      (value) => {
        if (typeof value !== "string") return value;
        const trimmed = value.trim();
        return trimmed === "" ? undefined : trimmed;
      },
      z.string().min(1).optional()
    ),
  paymentMethod: z.enum(["cash", "khata", "online", "partial"]),
  // Only meaningful for partial sales; the server resolves amountPaid
  // from paymentMethod for cash/online/khata. Sending 0 here is harmless
  // for those methods.
  amountPaid: z.number().min(0).default(0),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(req: NextRequest) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "pos.access")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const params = req.nextUrl.searchParams;
  const result = await listSales({
    businessId: tenant.businessId,
    page: parsePositiveInt(params.get("page")),
    from: params.get("from")?.trim() || undefined,
    to: params.get("to")?.trim() || undefined,
    customerId: params.get("customerId")?.trim() || undefined,
    query: params.get("q")?.trim() || undefined,
  });

  return apiSuccess({
    sales: result.sales,
    pagination: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    },
  });
}

export async function POST(req: NextRequest) {
  const tenantResult = await requireActiveTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "pos.access")) {
    return apiError("You don't have permission to do this.", 403);
  }

  // Plan-limit gate — monthly sales count. Runs before the transactional
  // createSale so a limit-hit leaves no trace.
  const limit = await checkResourceLimit(tenant.businessId, "salesPerMonth");
  if (!limit.allowed) {
    return apiError(
      "You've reached the monthly sales limit for your plan.",
      403,
      {
        code: "LIMIT_REACHED",
        fields: {
          resource: "salesPerMonth",
          current: String(limit.current),
          limit: String(limit.limit),
        },
      }
    );
  }

  const parsed = await parseJsonBody(req, createSaleSchema);
  if (!parsed.success) return parsed.response;

  const { items, customerId, paymentMethod, amountPaid, date } = parsed.data;

  const result: CreateSaleResult = await createSale({
    businessId: tenant.businessId,
    items,
    customerId,
    paymentMethod,
    amountPaid,
    date,
  });

  if (!result.success) {
    return mapCreateSaleError(result.code, result.details);
  }

  if (result.warning) {
    return apiSuccess({ sale: result.sale, warning: result.warning }, 201);
  }

  return apiSuccess({ sale: result.sale }, 201);
}

function mapCreateSaleError(
  code: CreateSaleErrorCode,
  details?: Record<string, unknown>
) {
  switch (code) {
    case "EMPTY_CART":
      return apiError("Cart is empty.", 400, { code });

    case "PRODUCT_NOT_FOUND":
      return apiError("One or more products could not be found.", 404, {
        code,
      });

    case "INSUFFICIENT_STOCK":
      return apiError("Not enough stock for one or more items.", 422, {
        code,
        fields: details
          ? Object.fromEntries(
              Object.entries(details).map(([k, v]) => [k, String(v)])
            )
          : undefined,
      });

    case "CUSTOMER_REQUIRED":
      return apiError("A customer is required for credit sales.", 422, {
        code,
      });

    case "CUSTOMER_NOT_FOUND":
      return apiError("Customer not found.", 404, { code });

    case "CREDIT_LIMIT_EXCEEDED":
      return apiError("Customer credit limit exceeded.", 422, {
        code,
        fields: details
          ? Object.fromEntries(
              Object.entries(details).map(([k, v]) => [k, String(v)])
            )
          : undefined,
      });

    case "INVALID_PAYMENT":
      return apiError(
        "Payment amount must be greater than zero and less than the total.",
        422,
        { code }
      );
  }
}