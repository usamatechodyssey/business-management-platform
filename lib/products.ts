// lib/products.ts
//
// Server-only product query/mutation logic. Shared by the inventory page
// (Server Component initial load) and the products API routes
// (client-side filter/pagination/mutations) so there is exactly one
// implementation of every query — no drift between what the page sees
// and what the API returns.

import { getDb } from "@/lib/db";
import type { Business, Product } from "@/types";

export const PRODUCT_PAGE_SIZE = 25;

export type ProductStatusFilter = "active" | "archived" | "all";

export interface ListProductsInput {
  businessId: string;
  page?: number;
  query?: string;
  category?: string;
  lowStock?: boolean;
  status?: ProductStatusFilter;
}

export interface ListProductsResult {
  products: Product[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  // Distinct non-empty categories for the filter dropdown. Returned with
  // every list so the page and API never disagree about what categories
  // exist.
  categories: string[];
}

// Escapes regex metacharacters so user input can't cause catastrophic
// backtracking or match unexpectedly.
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Uses the per-product threshold when set, otherwise the business default.
function buildFilter(
  input: ListProductsInput,
  globalThreshold: number
): Record<string, unknown> {
  const filter: Record<string, unknown> = { businessId: input.businessId };

  const status = input.status ?? "active";
  if (status === "active") filter.active = true;
  else if (status === "archived") filter.active = false;
  // "all" adds no active filter.

  if (input.query) {
    const escaped = escapeRegex(input.query.trim());
    if (escaped.length > 0) {
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { code: { $regex: escaped, $options: "i" } },
      ];
    }
  }

  if (input.category) {
    filter.category = input.category;
  }

  if (input.lowStock) {
    filter.$expr = {
      $lt: [
        "$stockQty",
        { $ifNull: ["$lowStockThreshold", globalThreshold] },
      ],
    };
  }

  return filter;
}

async function getGlobalThreshold(businessId: string): Promise<number> {
  const db = await getDb();
  const business = await db
    .collection<Business>("businesses")
    .findOne(
      { id: businessId },
      { projection: { "settings.lowStockThreshold": 1 } }
    );
  return business?.settings.lowStockThreshold ?? 0;
}

export async function listProducts(
  input: ListProductsInput
): Promise<ListProductsResult> {
  const db = await getDb();
  const collection = db.collection<Product>("products");

  const globalThreshold = await getGlobalThreshold(input.businessId);
  const filter = buildFilter(input, globalThreshold);

  const page = Math.max(1, Math.floor(input.page ?? 1));
  const skip = (page - 1) * PRODUCT_PAGE_SIZE;

  // Three independent queries — run in parallel.
  const [products, total, rawCategories] = await Promise.all([
    collection
      .find(filter)
      .sort({ name: 1 })
      .skip(skip)
      .limit(PRODUCT_PAGE_SIZE)
      .toArray(),
    collection.countDocuments(filter),
    // No generic here — the driver infers Key = "category" from the
    // literal and returns Array<string | undefined> (category is
    // optional on Product). We filter the undefined values below.
    collection.distinct("category", {
      businessId: input.businessId,
      category: { $type: "string", $ne: "" },
    }),
  ]);

  // Narrow string | undefined → string. The `$type: "string"` filter
  // already guarantees only strings at the DB level; this is the TS-side
  // narrowing that makes the compiler agree.
  const categories = rawCategories
    .filter((value): value is string => typeof value === "string")
    .sort((a, b) => a.localeCompare(b));

  return {
    products,
    page,
    pageSize: PRODUCT_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PRODUCT_PAGE_SIZE)),
    categories,
  };
}

export async function countLowStockProducts(
  businessId: string
): Promise<number> {
  const db = await getDb();
  const globalThreshold = await getGlobalThreshold(businessId);
  return db.collection<Product>("products").countDocuments({
    businessId,
    active: true,
    $expr: {
      $lt: [
        "$stockQty",
        { $ifNull: ["$lowStockThreshold", globalThreshold] },
      ],
    },
  });
}

export async function getProductById(
  businessId: string,
  productId: string
): Promise<Product | null> {
  const db = await getDb();
  return db
    .collection<Product>("products")
    .findOne({ id: productId, businessId });
}

// `excludeId` lets PATCH keep a product's own code when editing without
// tripping the uniqueness check.
export async function isProductCodeTaken(
  businessId: string,
  code: string,
  excludeId?: string
): Promise<boolean> {
  const db = await getDb();
  const filter: Record<string, unknown> = { businessId, code };
  if (excludeId) filter.id = { $ne: excludeId };
  const existing = await db
    .collection<Product>("products")
    .findOne(filter, { projection: { id: 1 } });
  return existing !== null;
}

export async function insertProduct(product: Product): Promise<void> {
  const db = await getDb();
  await db.collection<Product>("products").insertOne(product);
}

export async function updateProductFields(
  businessId: string,
  productId: string,
  updates: Partial<Omit<Product, "id" | "businessId">>
): Promise<Product | null> {
  const db = await getDb();
  return db.collection<Product>("products").findOneAndUpdate(
    { id: productId, businessId },
    { $set: updates },
    { returnDocument: "after" }
  );
}

// Archive = flip `active` to false. Never destroys data; POS/inventory
// lists filter archived products out but historical sales keep the
// reference. Same function handles un-archive via `active: true`.
export async function setProductActive(
  businessId: string,
  productId: string,
  active: boolean
): Promise<Product | null> {
  return updateProductFields(businessId, productId, { active });
}