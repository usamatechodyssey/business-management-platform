// app/(dashboard)/inventory/page.tsx
//
// Server Component. Parses URL filters, fetches the product page, the
// low-stock count, and the business-level threshold, then hands them to
// the client InventoryClient. All filtering/pagination is server-side;
// the client only manages modal state and URL pushes.

import { getTenantContext } from "@/lib/tenant";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { getDb } from "@/lib/db";
import {
  countLowStockProducts,
  listProducts,
  type ProductStatusFilter,
} from "@/lib/products";
import { InventoryClient } from "./InventoryClient";
import type { Business } from "@/types";

interface InventoryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const VALID_STATUSES: ProductStatusFilter[] = ["active", "archived", "all"];

function readString(value: string | string[] | undefined): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

export default async function InventoryPage({
  searchParams,
}: InventoryPageProps) {
  const params = await searchParams;
  const tenant = await getTenantContext();
  const locale = await getLocale();
  const dictionary = getDictionary(locale);

  const q = readString(params.q).trim();
  const category = readString(params.category).trim();
  const lowStock = params.lowStock === "true";
  const statusParam = readString(params.status);
  const status: ProductStatusFilter = VALID_STATUSES.includes(
    statusParam as ProductStatusFilter
  )
    ? (statusParam as ProductStatusFilter)
    : "active";

  const pageParam = Number(readString(params.page));
  const page =
    Number.isFinite(pageParam) && pageParam >= 1 ? Math.floor(pageParam) : 1;

  const [list, lowStockCount, business] = await Promise.all([
    listProducts({
      businessId: tenant.businessId,
      page,
      query: q || undefined,
      category: category || undefined,
      lowStock: lowStock || undefined,
      status,
    }),
    countLowStockProducts(tenant.businessId),
    getDb().then((db) =>
      db
        .collection<Business>("businesses")
        .findOne({ id: tenant.businessId })
    ),
  ]);

  const globalLowStockThreshold = business?.settings.lowStockThreshold ?? 0;

  return (
    <InventoryClient
      products={list.products}
      pagination={{
        page: list.page,
        pageSize: list.pageSize,
        total: list.total,
        totalPages: list.totalPages,
      }}
      categories={list.categories}
      lowStockCount={lowStockCount}
      globalLowStockThreshold={globalLowStockThreshold}
      filters={{ q, category, lowStock, status, page }}
      dictionary={dictionary}
    />
  );
}