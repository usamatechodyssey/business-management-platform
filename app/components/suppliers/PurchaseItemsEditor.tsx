// app/components/suppliers/PurchaseItemsEditor.tsx
"use client";

import { Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { translate, type Dictionary } from "@/lib/i18n";
import type { Product } from "@/types";

// A single row in the items editor. `id` is a local-only identifier used
// as the React key — it never leaves the client.
export interface LineItem {
  id: string;
  productId: string;
  qty: string;
  cost: string;
}

interface PurchaseItemsEditorProps {
  items: LineItem[];
  products: Product[];
  dictionary: Dictionary;
  disabled: boolean;
  onChange: (items: LineItem[]) => void;
}

// Row-level errors. Keyed by line item id so we can highlight the exact
// row that's wrong instead of dumping a single message under the list.
export interface LineItemErrors {
  [itemId: string]: {
    productId?: string;
    qty?: string;
    cost?: string;
  };
}

export function makeEmptyLineItem(): LineItem {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
    productId: "",
    qty: "1",
    cost: "",
  };
}

// Server sends products sorted by name; the editor keeps that order but
// disables archived entries so history stays truthful (they can't be
// purchased new).
export function PurchaseItemsEditor({
  items,
  products,
  dictionary,
  disabled,
  onChange,
}: PurchaseItemsEditorProps) {
  function updateItem(id: string, patch: Partial<LineItem>) {
    onChange(
      items.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  function removeItem(id: string) {
    onChange(items.filter((item) => item.id !== id));
  }

  function addItem() {
    onChange([...items, makeEmptyLineItem()]);
  }

  function handleProductChange(item: LineItem, productId: string) {
    const product = products.find((p) => p.id === productId);
    // Default the cost to the product's current cost price so most
    // purchases need zero typing. The user can still override for a
    // one-off deal.
    const defaultCost = product ? String(product.costPrice) : "";
    updateItem(item.id, {
      productId,
      cost: item.cost === "" ? defaultCost : item.cost,
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {translate(dictionary, "suppliers.purchase.items")}
        </h3>
        <button
          type="button"
          onClick={addItem}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {translate(dictionary, "suppliers.purchase.addItem")}
        </button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface-muted px-3 py-6 text-center text-sm text-text-muted">
          {translate(dictionary, "suppliers.purchase.errors.noItems")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const product = products.find((p) => p.id === item.productId);
            const qty = Number(item.qty);
            const cost = Number(item.cost);
            const subtotal =
              Number.isFinite(qty) && Number.isFinite(cost) ? qty * cost : 0;

            return (
              <li
                key={item.id}
                className="rounded-lg border border-border bg-surface p-3"
              >
                <div className="flex flex-col gap-2">
                  {/* Product selector */}
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-text-muted">
                      {translate(dictionary, "suppliers.purchase.product")}
                    </span>
                    <select
                      value={item.productId}
                      onChange={(event) =>
                        handleProductChange(item, event.target.value)
                      }
                      disabled={disabled}
                      className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">
                        {translate(
                          dictionary,
                          "suppliers.purchase.selectProduct"
                        )}
                      </option>
                      {products.map((p) => (
                        <option
                          key={p.id}
                          value={p.id}
                          disabled={!p.active}
                        >
                          {p.name} ({p.code})
                          {!p.active ? " — archived" : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {/* Qty */}
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-text-muted">
                        {translate(dictionary, "suppliers.purchase.qty")}
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        value={item.qty}
                        onChange={(event) =>
                          updateItem(item.id, { qty: event.target.value })
                        }
                        disabled={disabled}
                        className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </label>

                    {/* Cost */}
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-text-muted">
                        {translate(dictionary, "suppliers.purchase.cost")}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        value={item.cost}
                        onChange={(event) =>
                          updateItem(item.id, { cost: event.target.value })
                        }
                        disabled={disabled}
                        className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </label>

                    {/* Subtotal (read-only) */}
                    <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
                      <span className="text-xs font-medium text-text-muted">
                        {translate(dictionary, "suppliers.purchase.subtotal")}
                      </span>
                      <div className="flex h-10 items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 text-sm font-medium text-foreground">
                        <span>{product ? product.name.slice(0, 12) : "—"}</span>
                        <span>{formatCurrency(subtotal)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      disabled={disabled}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-danger transition-colors hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {translate(
                        dictionary,
                        "suppliers.purchase.removeItem"
                      )}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}