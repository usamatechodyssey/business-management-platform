// app/components/suppliers/SupplierCard.tsx
"use client";

import {
  Edit3,
  ShoppingBag,
  Trash2,
  Wallet,
  Receipt,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { translate, type Dictionary } from "@/lib/i18n";
import type { Supplier } from "@/types";

interface SupplierCardProps {
  supplier: Supplier;
  dictionary: Dictionary;
  onViewPurchases: (supplier: Supplier) => void;
  onRecordPurchase: (supplier: Supplier) => void;
  onPay: (supplier: Supplier) => void;
  onEdit: (supplier: Supplier) => void;
  onDelete: (supplier: Supplier) => void;
}

// Icon-only action button with a tooltip via aria-label. Keeps the card
// scannable on mobile, where five labelled buttons would wrap awkwardly.
function ActionButton({
  label,
  onClick,
  icon,
  tone = "neutral",
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  tone?: "neutral" | "primary" | "danger";
}) {
  const toneClasses =
    tone === "danger"
      ? "hover:bg-danger/10 hover:text-danger"
      : tone === "primary"
        ? "hover:bg-primary/10 hover:text-primary"
        : "hover:bg-surface-muted hover:text-foreground";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={[
        "rounded-md p-2 text-text-muted transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        toneClasses,
      ].join(" ")}
    >
      {icon}
    </button>
  );
}

export function SupplierCard({
  supplier,
  dictionary,
  onViewPurchases,
  onRecordPurchase,
  onPay,
  onEdit,
  onDelete,
}: SupplierCardProps) {
  const hasDue = supplier.totalOwed > 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-foreground">
            {supplier.name}
          </h3>
          <p className="mt-0.5 text-sm text-text-muted">{supplier.phone}</p>
          {supplier.contactPerson && (
            <p className="text-xs text-text-muted">{supplier.contactPerson}</p>
          )}
        </div>

        <div
          className={[
            "shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold",
            hasDue
              ? "bg-warning/10 text-warning"
              : "bg-success/10 text-success",
          ].join(" ")}
        >
          {hasDue
            ? translate(dictionary, "suppliers.card.owes", {
                amount: formatCurrency(supplier.totalOwed),
              })
            : translate(dictionary, "suppliers.card.clear")}
        </div>
      </div>

      {supplier.address && (
        <p className="truncate text-xs text-text-muted">{supplier.address}</p>
      )}

      <div className="flex items-center justify-end gap-1 border-t border-border pt-2">
        <ActionButton
          label={translate(dictionary, "suppliers.card.viewPurchases")}
          onClick={() => onViewPurchases(supplier)}
          icon={<Receipt className="h-4 w-4" aria-hidden="true" />}
        />
        <ActionButton
          label={translate(dictionary, "suppliers.card.recordPurchase")}
          onClick={() => onRecordPurchase(supplier)}
          icon={<ShoppingBag className="h-4 w-4" aria-hidden="true" />}
          tone="primary"
        />
        <ActionButton
          label={translate(dictionary, "suppliers.card.pay")}
          onClick={() => onPay(supplier)}
          icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
          tone="primary"
        />
        <ActionButton
          label={translate(dictionary, "suppliers.card.edit")}
          onClick={() => onEdit(supplier)}
          icon={<Edit3 className="h-4 w-4" aria-hidden="true" />}
        />
        <ActionButton
          label={translate(dictionary, "suppliers.card.delete")}
          onClick={() => onDelete(supplier)}
          icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
          tone="danger"
        />
      </div>
    </div>
  );
}