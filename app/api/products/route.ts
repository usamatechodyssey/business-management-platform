// app/api/products/route.ts
//
// GET  — paginated product list with search / category / low-stock / status
//        filters. Requires "inventory.view".
// POST — create a product. Requires "inventory.manage".
//
// Field-level validation lives client-side (ProductFormModal) with the
// user's locale; server-side Zod is a security backstop whose English
// messages are never surfaced. Cross-cutting checks (code uniqueness,
// plan limit) return a translatable `code`.

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/validate";
import { requireTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { checkResourceLimit } from "@/lib/limits";
import { requireActiveTenant } from "@/lib/subscription-guard";
import {
  insertProduct,
  isProductCodeTaken,
  listProducts,
  type ProductStatusFilter,
} from "@/lib/products";
import type { Product } from "@/types";

const VALID_STATUSES: ProductStatusFilter[] = ["active", "archived", "all"];

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.floor(n);
}

const emptyToUndefined = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

const createProductSchema = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().min(1).max(50),
  category: z.preprocess(
    emptyToUndefined,
    z.string().max(50).optional()
  ),
  unit: z.preprocess(
    emptyToUndefined,
    z.string().max(20).optional()
  ),
  stockQty: z.number().int().min(0),
  costPrice: z.number().min(0),
  sellPrice: z.number().min(0),
  lowStockThreshold: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.number().int().min(0).optional()
  ),
});

export async function GET(req: NextRequest) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "inventory.view")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const params = req.nextUrl.searchParams;
  const statusParam = params.get("status");
  const status: ProductStatusFilter | undefined =
    statusParam && VALID_STATUSES.includes(statusParam as ProductStatusFilter)
      ? (statusParam as ProductStatusFilter)
      : undefined;

  const result = await listProducts({
    businessId: tenant.businessId,
    page: parsePositiveInt(params.get("page")),
    query: params.get("q")?.trim() || undefined,
    category: params.get("category")?.trim() || undefined,
    lowStock: params.get("lowStock") === "true" ? true : undefined,
    status,
  });

  return apiSuccess({
    products: result.products,
    pagination: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    },
    categories: result.categories,
  });
}

export async function POST(req: NextRequest) {
  const tenantResult = await requireActiveTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "inventory.manage")) {
    return apiError("You don't have permission to do this.", 403);
  }

  // Plan-limit gate. Runs before insert so a limit-hit leaves no trace.
  const limit = await checkResourceLimit(tenant.businessId, "products");
  if (!limit.allowed) {
    return apiError(
      "You've reached the product limit for your plan.",
      403,
      {
        code: "LIMIT_REACHED",
        fields: {
          resource: "products",
          current: String(limit.current),
          limit: String(limit.limit),
        },
      }
    );
  }

  const parsed = await parseJsonBody(req, createProductSchema);
  if (!parsed.success) return parsed.response;

  const { name, code, category, unit, stockQty, costPrice, sellPrice, lowStockThreshold } =
    parsed.data;

  if (await isProductCodeTaken(tenant.businessId, code)) {
    return apiError("Product code is already in use.", 409, {
      code: "PRODUCT_CODE_TAKEN",
    });
  }

  const product: Product = {
    id: crypto.randomUUID(),
    businessId: tenant.businessId,
    name,
    code,
    stockQty,
    costPrice,
    sellPrice,
    active: true,
  };

  if (category) product.category = category;
  if (unit) product.unit = unit;
  if (typeof lowStockThreshold === "number") {
    product.lowStockThreshold = lowStockThreshold;
  }

  await insertProduct(product);

  return apiSuccess(product, 201);
}