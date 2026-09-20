// app/(dashboard)/inventory/InventoryClient.tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { Select } from "@/app/components/ui/Select";
import { Modal } from "@/app/components/ui/Modal";
import { Pagination } from "@/app/components/ui/Pagination";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { useToast } from "@/app/components/ui/Toast";
import { ProductFormModal } from "@/app/components/inventory/ProductFormModal";
import { ProductTable } from "@/app/components/inventory/ProductTable";
import { LowStockBanner } from "@/app/components/inventory/LowStockBanner";
import { translate, type Dictionary } from "@/lib/i18n";
import type { Product } from "@/types";

type StatusFilter = "active" | "archived" | "all";

interface InventoryFilters {
  q: string;
  category: string;
  lowStock: boolean;
  status: StatusFilter;
  page: number;
}

interface InventoryClientProps {
  products: Product[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  categories: string[];
  lowStockCount: number;
  globalLowStockThreshold: number;
  filters: InventoryFilters;
  dictionary: Dictionary;
}

const SEARCH_DEBOUNCE_MS = 300;

export function InventoryClient({
  products,
  pagination,
  categories,
  lowStockCount,
  globalLowStockThreshold,
  filters,
  dictionary,
}: InventoryClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { push: pushToast } = useToast();

  const [searchInput, setSearchInput] = useState(filters.q);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [archivingProduct, setArchivingProduct] = useState<Product | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  // Debounced search — only fires a navigation when the user stops typing.
  // Compared against filters.q so we don't re-push the same URL after a
  // re-render.
  useEffect(() => {
    if (searchInput === filters.q) return;
    const timeout = window.setTimeout(() => {
      pushFilters({ q: searchInput, page: 1 });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
    // pushFilters is a stable closure over `filters`; including it would
    // re-run the effect on every navigation, defeating the debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function pushFilters(updates: Partial<InventoryFilters>) {
    const next: InventoryFilters = { ...filters, ...updates };
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.category) params.set("category", next.category);
    if (next.lowStock) params.set("lowStock", "true");
    if (next.status !== "active") params.set("status", next.status);
    if (next.page > 1) params.set("page", String(next.page));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const hasFilters =
    filters.q !== "" ||
    filters.category !== "" ||
    filters.lowStock ||
    filters.status !== "active";

  function clearFilters() {
    setSearchInput("");
    router.push(pathname);
  }

  function handleAddClick() {
    setEditingProduct(null);
    setIsFormOpen(true);
  }

  function handleEditClick(product: Product) {
    setEditingProduct(product);
    setIsFormOpen(true);
  }

  function handleFormSuccess() {
    setIsFormOpen(false);
    setEditingProduct(null);
    router.refresh();
  }

  async function confirmArchive() {
    if (!archivingProduct || isArchiving) return;
    setIsArchiving(true);
    try {
      const response = await fetch(`/api/products/${archivingProduct.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Archive request failed");
      pushToast({
        message: translate(dictionary, "inventory.archived"),
        variant: "success",
      });
      setArchivingProduct(null);
      router.refresh();
    } catch {
      pushToast({
        message: translate(dictionary, "errors.generic"),
        variant: "error",
      });
    } finally {
      setIsArchiving(false);
    }
  }

  const categoryOptions = [
    {
      value: "",
      label: translate(dictionary, "inventory.filters.allCategories"),
    },
    ...categories.map((value) => ({ value, label: value })),
  ];

  const statusOptions = [
    {
      value: "active",
      label: translate(dictionary, "inventory.filters.statusActive"),
    },
    {
      value: "archived",
      label: translate(dictionary, "inventory.filters.statusArchived"),
    },
    {
      value: "all",
      label: translate(dictionary, "inventory.filters.statusAll"),
    },
  ];

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {translate(dictionary, "inventory.title")}
          </h1>
          <p className="text-sm text-text-muted">
            {translate(dictionary, "inventory.subtitle")}
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={handleAddClick}
          leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
        >
          {translate(dictionary, "inventory.addProduct")}
        </Button>
      </div>

      {/* Low-stock banner only on the default active-and-not-filtered view,
          so it doesn't compete with the archived/all views. */}
      {filters.status === "active" && !filters.lowStock && (
        <LowStockBanner count={lowStockCount} dictionary={dictionary} />
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="inventory-search" className="sr-only">
              {translate(dictionary, "inventory.searchPlaceholder")}
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
                aria-hidden="true"
              />
              <input
                id="inventory-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={translate(
                  dictionary,
                  "inventory.searchPlaceholder"
                )}
                className="h-11 w-full rounded-lg border border-border bg-surface ps-9 pe-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:w-auto">
            <Select
              label={translate(dictionary, "inventory.filters.category")}
              options={categoryOptions}
              value={filters.category}
              onChange={(event) =>
                pushFilters({ category: event.target.value, page: 1 })
              }
            />
            <Select
              label={translate(dictionary, "inventory.filters.status")}
              options={statusOptions}
              value={filters.status}
              onChange={(event) =>
                pushFilters({
                  status: event.target.value as StatusFilter,
                  page: 1,
                })
              }
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              pushFilters({ lowStock: !filters.lowStock, page: 1 })
            }
            aria-pressed={filters.lowStock}
            className={[
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              filters.lowStock
                ? "border-warning/40 bg-warning/10 text-warning"
                : "border-border bg-surface text-text-muted hover:bg-surface-muted",
            ].join(" ")}
          >
            {translate(dictionary, "inventory.filters.lowStock")}
          </button>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-text-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              {translate(dictionary, "inventory.filters.clear")}
            </button>
          )}
        </div>
      </div>

      {/* Body: contextual empty state, or the table */}
      {products.length === 0 && !hasFilters ? (
        <EmptyState
          title={translate(dictionary, "inventory.empty.title")}
          description={translate(
            dictionary,
            "inventory.empty.description"
          )}
          action={
            <Button type="button" variant="primary" onClick={handleAddClick}>
              {translate(dictionary, "inventory.addProduct")}
            </Button>
          }
        />
      ) : products.length === 0 && filters.status === "archived" ? (
        <EmptyState
          title={translate(dictionary, "inventory.empty.archivedTitle")}
          description={translate(
            dictionary,
            "inventory.empty.archivedDescription"
          )}
        />
      ) : products.length === 0 ? (
        <EmptyState
          title={translate(dictionary, "inventory.empty.filterTitle")}
          description={translate(
            dictionary,
            "inventory.empty.filterDescription"
          )}
        />
      ) : (
        <>
          <ProductTable
            products={products}
            dictionary={dictionary}
            globalLowStockThreshold={globalLowStockThreshold}
            onEdit={handleEditClick}
            onArchive={setArchivingProduct}
          />
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            dictionary={dictionary}
          />
        </>
      )}

      <ProductFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        product={editingProduct}
        dictionary={dictionary}
        onSuccess={handleFormSuccess}
      />

      <Modal
        isOpen={archivingProduct !== null}
        onClose={() => setArchivingProduct(null)}
        title={translate(dictionary, "inventory.archiveConfirm.title")}
        closeOnBackdropClick={!isArchiving}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setArchivingProduct(null)}
              disabled={isArchiving}
            >
              {translate(dictionary, "inventory.archiveConfirm.cancel")}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={confirmArchive}
              isLoading={isArchiving}
            >
              {translate(dictionary, "inventory.archiveConfirm.confirm")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-foreground">
          {translate(dictionary, "inventory.archiveConfirm.description")}
        </p>
      </Modal>
    </div>
  );
}