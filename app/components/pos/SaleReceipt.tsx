// app/components/pos/SaleReceipt.tsx
"use client";

import { CheckCircle2 } from "lucide-react";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { Badge } from "@/app/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { translate, type Dictionary, type Locale } from "@/lib/i18n";
import type { Sale } from "@/types";

interface SaleReceiptProps {
  sale: Sale | null;
  locale: Locale;
  dictionary: Dictionary;
  // Dismisses the receipt. Parent is responsible for resetting the cart
  // so the next sale starts clean.
  onClose: () => void;
}

export function SaleReceipt({
  sale,
  locale,
  dictionary,
  onClose,
}: SaleReceiptProps) {
  const isOpen = sale !== null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={translate(dictionary, "pos.receipt.title")}
      closeOnBackdropClick={false}
      footer={
        <Button type="button" variant="primary" fullWidth onClick={onClose}>
          {translate(dictionary, "pos.receipt.newSale")}
        </Button>
      }
    >
      {sale && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
            </div>
          </div>

          <div className="flex flex-col gap-1 text-center">
            <p className="text-sm text-text-muted">
              {translate(dictionary, "pos.receipt.saleId")}
            </p>
            <p className="font-mono text-sm text-foreground">
              {sale.id.slice(0, 8)}
            </p>
            <p className="text-xs text-text-muted">
              {formatDate(sale.date, locale)}
            </p>
          </div>

          {sale.customerName && (
            <div className="rounded-lg bg-surface-muted px-3 py-2 text-sm">
              <span className="text-text-muted">
                {translate(dictionary, "pos.receipt.customer")}:{" "}
              </span>
              <span className="font-medium text-foreground">
                {sale.customerName}
              </span>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">
              {translate(dictionary, "pos.receipt.items")}
            </p>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {sale.items.map((item) => (
                <li
                  key={item.productId}
                  className="flex items-center justify-between gap-2 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">
                      {item.productName}
                    </p>
                    <p className="text-xs text-text-muted tabular-nums">
                      {item.qty} × {formatCurrency(item.price)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                    {formatCurrency(item.qty * item.price)}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-1.5 border-t border-border pt-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-text-muted">
                {translate(dictionary, "pos.receipt.total")}
              </span>
              <span className="font-semibold text-foreground tabular-nums">
                {formatCurrency(sale.total)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">
                {translate(dictionary, "pos.receipt.paid")}
              </span>
              <span className="text-foreground tabular-nums">
                {formatCurrency(sale.amountPaid)}
              </span>
            </div>
            {sale.amountDue > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-text-muted">
                  {translate(dictionary, "pos.receipt.due")}
                </span>
                <Badge variant="warning">
                  {formatCurrency(sale.amountDue)}
                </Badge>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}