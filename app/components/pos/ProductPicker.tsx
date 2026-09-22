// app/components/pos/ProductPicker.tsx
"use client";

import { useMemo, useState } from "react";
import { Package, Search } from "lucide-react";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { formatCurrency } from "@/lib/format";
import { translate, type Dictionary } from "@/lib/i18n";
import type { Product } from "@/types";

interface ProductPickerProps {
  products: Product[];
  // productId → qty already in cart, so tiles can show a small badge.
  cartQuantities: Record<string, number>;
  onAddProduct: (product: Product) => void;
  dictionary: Dictionary;
  disabled?: boolean;
}

// Grid of tappable product tiles. Filtering is client-side (product
// catalogs for small shops are well under 500 items). Out-of-stock tiles
// stay visible but are disabled — the owner can see what exists without
// running a separate query.
export function ProductPicker({
  products,
  cartQuantities,
  onAddProduct,
  dictionary,
  disabled = false,
}: ProductPickerProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return products;
    return products.filter((p) => {
      return (
        p.name.toLowerCase().includes(needle) ||
        p.code.toLowerCase().includes(needle) ||
        (p.category ?? "").toLowerCase().includes(needle)
      );
    });
  }, [products, search]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={translate(dictionary, "pos.searchPlaceholder")}
          aria-label={translate(dictionary, "pos.searchPlaceholder")}
          disabled={disabled}
          className="h-11 w-full rounded-lg border border-border bg-surface ps-9 pe-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      {products.length === 0 ? (
        <EmptyState
          title={translate(dictionary, "pos.products.empty")}
          icon={<Package className="h-6 w-6" aria-hidden="true" />}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={translate(dictionary, "pos.products.noMatch")}
          icon={<Search className="h-6 w-6" aria-hidden="true" />}
        />
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product) => {
            const outOfStock = product.stockQty <= 0;
            const inCart = cartQuantities[product.id] ?? 0;
            const isDisabled = disabled || outOfStock;

            return (
              <button
                key={product.id}
                type="button"
                onClick={() => onAddProduct(product)}
                disabled={isDisabled}
                className={[
                  "relative flex flex-col gap-1 rounded-xl border p-3 text-start transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  "min-h-23",
                  isDisabled
                    ? "cursor-not-allowed border-border bg-surface-muted opacity-60"
                    : "border-border bg-surface hover:border-primary/40 hover:bg-primary/5 active:bg-primary/10",
                ].join(" ")}
              >
                <p className="line-clamp-2 text-sm font-medium text-foreground">
                  {product.name}
                </p>
                <p className="mt-auto text-sm font-semibold text-primary">
                  {formatCurrency(product.sellPrice)}
                </p>
                <p className="text-xs text-text-muted">
                  {outOfStock
                    ? translate(dictionary, "pos.products.outOfStock")
                    : translate(dictionary, "pos.products.stockLabel", {
                        count: product.stockQty,
                      })}
                </p>

                {inCart > 0 && !isDisabled && (
                  <span className="absolute inset-e-2 top-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-white">
                    {inCart}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}