// app/components/pos/Cart.tsx
"use client";

import { Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { formatCurrency } from "@/lib/format";
import { translate, type Dictionary } from "@/lib/i18n";
import type { Product } from "@/types";

// Local UI type — never sent to the server as-is. The POS client converts
// this into the shape createSale expects.
export interface CartItem {
  product: Product;
  qty: number;
  // Snapshot of product.sellPrice at the moment it was added. Kept in
  // sync with the product if the user hasn't touched it and the product
  // is still in the catalog. Never authoritative — the server re-reads
  // the price from the product doc if it ever needs to.
  price: number;
}

interface CartProps {
  items: CartItem[];
  dictionary: Dictionary;
  onIncrease: (productId: string) => void;
  onDecrease: (productId: string) => void;
  onRemove: (productId: string) => void;
  onClear: () => void;
  onCheckout: () => void;
  disabled?: boolean;
}

export function Cart({
  items,
  dictionary,
  onIncrease,
  onDecrease,
  onRemove,
  onClear,
  onCheckout,
  disabled = false,
}: CartProps) {
  const total = items.reduce((sum, item) => sum + item.qty * item.price, 0);
  const itemCount = items.reduce((sum, item) => sum + item.qty, 0);
  const isEmpty = items.length === 0;

  const countKey =
    itemCount === 1 ? "pos.cart.itemCountOne" : "pos.cart.itemCountOther";

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-semibold text-foreground">
            {translate(dictionary, "pos.cart.title")}
          </h2>
          {!isEmpty && (
            <span className="text-xs text-text-muted">
              {translate(dictionary, countKey, { count: itemCount })}
            </span>
          )}
        </div>
        {!isEmpty && (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-text-muted transition-colors hover:bg-surface-muted hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            {translate(dictionary, "pos.cart.clear")}
          </button>
        )}
      </div>

      {/* Body */}
      {isEmpty ? (
        <div className="flex flex-1 items-center justify-center py-8">
          <EmptyState
            title={translate(dictionary, "pos.cart.empty")}
            description={translate(dictionary, "pos.cart.emptyHint")}
            icon={<ShoppingCart className="h-6 w-6" aria-hidden="true" />}
          />
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-border overflow-y-auto">
          {items.map((item) => (
            <li key={item.product.id} className="flex flex-col gap-2 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {item.product.name}
                  </p>
                  <p className="text-xs text-text-muted">
                    {formatCurrency(item.price)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(item.product.id)}
                  disabled={disabled}
                  aria-label={translate(dictionary, "pos.cart.removeItem")}
                  className="shrink-0 rounded-md p-1 text-text-muted transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onDecrease(item.product.id)}
                    disabled={disabled}
                    aria-label={translate(dictionary, "pos.cart.decrease")}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <span className="min-w-8 text-center text-sm font-semibold tabular-nums">
                    {item.qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => onIncrease(item.product.id)}
                    disabled={disabled || item.qty >= item.product.stockQty}
                    aria-label={translate(dictionary, "pos.cart.increase")}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>

                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatCurrency(item.qty * item.price)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Footer */}
      {!isEmpty && (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <div className="flex items-center justify-between text-base">
            <span className="font-medium text-text-muted">
              {translate(dictionary, "pos.cart.total")}
            </span>
            <span className="text-xl font-bold text-foreground">
              {formatCurrency(total)}
            </span>
          </div>
          <Button
            type="button"
            variant="primary"
            fullWidth
            onClick={onCheckout}
            disabled={disabled}
          >
            {translate(dictionary, "pos.cart.checkout")}
          </Button>
        </div>
      )}
    </div>
  );
}