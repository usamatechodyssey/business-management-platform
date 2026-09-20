// app/components/inventory/ProductTable.tsx
"use client";

import { Archive, Pencil } from "lucide-react";
import { Table, type TableColumn } from "@/app/components/ui/Table";
import { Badge } from "@/app/components/ui/Badge";
import { formatCurrency } from "@/lib/format";
import { translate, type Dictionary } from "@/lib/i18n";
import type { Product } from "@/types";

interface ProductTableProps {
  products: Product[];
  dictionary: Dictionary;
  // Used to resolve low-stock status for products without their own
  // lowStockThreshold.
  globalLowStockThreshold: number;
  onEdit: (product: Product) => void;
  onArchive: (product: Product) => void;
}

export function ProductTable({
  products,
  dictionary,
  globalLowStockThreshold,
  onEdit,
  onArchive,
}: ProductTableProps) {
  function isLowStock(product: Product): boolean {
    if (!product.active) return false;
    const threshold = product.lowStockThreshold ?? globalLowStockThreshold;
    return product.stockQty < threshold;
  }

  const columns: TableColumn<Product>[] = [
    {
      key: "name",
      header: translate(dictionary, "inventory.columns.name"),
      render: (product) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate font-medium text-foreground">
            {product.name}
          </span>
          {!product.active && (
            <Badge variant="neutral">
              {translate(dictionary, "inventory.badges.archived")}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "code",
      header: translate(dictionary, "inventory.columns.code"),
    },
    {
      key: "category",
      header: translate(dictionary, "inventory.columns.category"),
      render: (product) =>
        product.category ?? <span className="text-text-muted">—</span>,
    },
    {
      key: "stockQty",
      header: translate(dictionary, "inventory.columns.stock"),
      align: "end",
      render: (product) => (
        <div className="flex items-center justify-end gap-2">
          <span>{product.stockQty}</span>
          {isLowStock(product) && (
            <Badge variant="warning">
              {translate(dictionary, "inventory.badges.lowStock")}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "costPrice",
      header: translate(dictionary, "inventory.columns.costPrice"),
      align: "end",
      render: (product) => formatCurrency(product.costPrice),
    },
    {
      key: "sellPrice",
      header: translate(dictionary, "inventory.columns.sellPrice"),
      align: "end",
      render: (product) => formatCurrency(product.sellPrice),
    },
    {
      key: "id",
      header: translate(dictionary, "inventory.columns.actions"),
      align: "end",
      render: (product) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => onEdit(product)}
            aria-label={translate(dictionary, "inventory.actions.edit")}
            className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
          {product.active && (
            <button
              type="button"
              onClick={() => onArchive(product)}
              aria-label={translate(dictionary, "inventory.actions.archive")}
              className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Archive className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      data={products}
      getRowId={(product) => product.id}
    />
  );
}