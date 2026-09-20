// app/components/suppliers/PurchaseFormModal.tsx
"use client";

import { useEffect, useState, type SubmitEvent } from "react";
import { Modal } from "@/app/components/ui/Modal";
import { Input } from "@/app/components/ui/Input";
import { Button } from "@/app/components/ui/Button";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { useToast } from "@/app/components/ui/Toast";
import {
  PurchaseItemsEditor,
  makeEmptyLineItem,
  type LineItem,
} from "./PurchaseItemsEditor";
import { formatCurrency } from "@/lib/format";
import { translate, type Dictionary } from "@/lib/i18n";
import type { Product, Supplier } from "@/types";

interface PurchaseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier;
  products: Product[];
  dictionary: Dictionary;
  onSuccess: () => void;
}

// Returns today's date in Pakistan Standard Time as YYYY-MM-DD. Uses the
// UTC-shifted trick so the value is correct even at 02:00 PKT when UTC is
// still on the previous calendar day.
function todayInPKT(): string {
  const shifted = new Date(Date.now() + 5 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface FormErrors {
  items?: string;
  invoiceNo?: string;
  initialPayment?: string;
  // Row-level errors keyed by line item id.
  rows: Record<string, { productId?: string; qty?: string; cost?: string }>;
}

const EMPTY_ERRORS: FormErrors = { rows: {} };

// Converts a string field to a number. Returns NaN for non-numeric so
// callers can distinguish "empty" ("" → NaN too) from invalid separately
// by checking the source string length when needed.
function toNumber(value: string): number {
  return Number(value);
}

export function PurchaseFormModal({
  isOpen,
  onClose,
  supplier,
  products,
  dictionary,
  onSuccess,
}: PurchaseFormModalProps) {
  const { push } = useToast();

  const [items, setItems] = useState<LineItem[]>([]);
  const [date, setDate] = useState(todayInPKT());
  const [invoiceNo, setInvoiceNo] = useState("");
  const [initialPayment, setInitialPayment] = useState("0");
  const [errors, setErrors] = useState<FormErrors>(EMPTY_ERRORS);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset the whole form each time the modal opens for a new supplier.
  useEffect(() => {
    if (!isOpen) return;
    setItems(products.length > 0 ? [makeEmptyLineItem()] : []);
    setDate(todayInPKT());
    setInvoiceNo("");
    setInitialPayment("0");
    setErrors(EMPTY_ERRORS);
    setFormError(null);
  }, [isOpen, supplier.id, products.length]);

  // Live total for the footer summary.
  const totalCost = items.reduce((sum, item) => {
    const qty = toNumber(item.qty);
    const cost = toNumber(item.cost);
    if (!Number.isFinite(qty) || !Number.isFinite(cost)) return sum;
    return sum + qty * cost;
  }, 0);

  function validate(): FormErrors {
    const next: FormErrors = { rows: {} };

    if (items.length === 0) {
      next.items = translate(dictionary, "suppliers.purchase.errors.noItems");
    }

    for (const item of items) {
      const rowErrors: { productId?: string; qty?: string; cost?: string } = {};

      if (!item.productId) {
        rowErrors.productId = translate(
          dictionary,
          "suppliers.purchase.errors.productRequired"
        );
      }

      const qty = toNumber(item.qty);
      if (
        item.qty.trim() === "" ||
        !Number.isFinite(qty) ||
        qty <= 0 ||
        !Number.isInteger(qty)
      ) {
        rowErrors.qty = translate(
          dictionary,
          "suppliers.purchase.errors.qtyInvalid"
        );
      }

      const cost = toNumber(item.cost);
      if (
        item.cost.trim() === "" ||
        !Number.isFinite(cost) ||
        cost < 0
      ) {
        rowErrors.cost = translate(
          dictionary,
          "suppliers.purchase.errors.costInvalid"
        );
      }

      if (Object.keys(rowErrors).length > 0) {
        next.rows[item.id] = rowErrors;
      }
    }

    if (invoiceNo.length > 50) {
      next.invoiceNo = translate(dictionary, "errors.generic");
    }

    const payment = toNumber(initialPayment);
    if (
      initialPayment.trim() === "" ||
      !Number.isFinite(payment) ||
      payment < 0
    ) {
      next.initialPayment = translate(
        dictionary,
        "suppliers.purchase.errors.paymentInvalid"
      );
    } else if (payment > totalCost) {
      next.initialPayment = translate(
        dictionary,
        "suppliers.purchase.errors.paymentExceedsTotal"
      );
    }

    return next;
  }

  function hasAnyError(errors: FormErrors): boolean {
    return (
      !!errors.items ||
      !!errors.invoiceNo ||
      !!errors.initialPayment ||
      Object.keys(errors.rows).length > 0
    );
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (isSubmitting) return;

    setFormError(null);
    const validationErrors = validate();
    if (hasAnyError(validationErrors)) {
      setErrors(validationErrors);
      return;
    }
    setErrors(EMPTY_ERRORS);
    setIsSubmitting(true);

    const payload = {
      items: items.map((item) => ({
        productId: item.productId,
        qty: toNumber(item.qty),
        cost: toNumber(item.cost),
      })),
      date,
      invoiceNo: invoiceNo.trim(),
      initialPayment: toNumber(initialPayment),
    };

    try {
      const response = await fetch(
        `/api/suppliers/${supplier.id}/purchases`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (response.ok) {
        push({
          message: translate(dictionary, "suppliers.purchase.recorded"),
          variant: "success",
        });
        onSuccess();
        return;
      }

      let responseBody: { error?: { code?: string } } | null = null;
      try {
        responseBody = (await response.json()) as {
          error?: { code?: string };
        };
      } catch {
        responseBody = null;
      }

      if (responseBody?.error?.code === "PRODUCT_NOT_FOUND") {
        setFormError(translate(dictionary, "errors.generic"));
        return;
      }
      if (responseBody?.error?.code === "INVALID_PAYMENT") {
        setErrors({
          ...EMPTY_ERRORS,
          initialPayment: translate(
            dictionary,
            "suppliers.purchase.errors.paymentExceedsTotal"
          ),
        });
        return;
      }

      setFormError(translate(dictionary, "errors.generic"));
    } catch {
      push({
        message: translate(dictionary, "errors.generic"),
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={translate(dictionary, "suppliers.purchase.title")}
      closeOnBackdropClick={!isSubmitting}
      footer={
        products.length === 0 ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            {translate(dictionary, "common.close")}
          </Button>
        ) : (
          <>
            <div className="me-auto flex flex-col text-start">
              <span className="text-xs text-text-muted">
                {translate(dictionary, "suppliers.purchase.totalCost")}
              </span>
              <span className="text-base font-semibold text-foreground">
                {formatCurrency(totalCost)}
              </span>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {translate(dictionary, "common.cancel")}
            </Button>
            <Button
              type="submit"
              form="purchase-form"
              variant="primary"
              isLoading={isSubmitting}
            >
              {translate(dictionary, "suppliers.purchase.recordButton")}
            </Button>
          </>
        )
      }
    >
      {products.length === 0 ? (
        <EmptyState
          title={translate(
            dictionary,
            "suppliers.purchase.noProductsTitle"
          )}
          description={translate(
            dictionary,
            "suppliers.purchase.noProductsDescription"
          )}
        />
      ) : (
        <form
          id="purchase-form"
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-4"
        >
          {formError && (
            <div
              role="alert"
              className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              {formError}
            </div>
          )}

          <div className="rounded-lg bg-surface-muted px-3 py-2 text-sm">
            <span className="text-text-muted">
              {translate(dictionary, "suppliers.fields.name")}:{" "}
            </span>
            <span className="font-medium text-foreground">
              {supplier.name}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={translate(dictionary, "suppliers.purchase.date")}
              name="date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              disabled={isSubmitting}
              required
            />
            <Input
              label={translate(dictionary, "suppliers.purchase.invoiceNo")}
              name="invoiceNo"
              type="text"
              value={invoiceNo}
              onChange={(event) => setInvoiceNo(event.target.value)}
              error={errors.invoiceNo}
              helperText={translate(
                dictionary,
                "suppliers.purchase.invoiceNoHelper"
              )}
              disabled={isSubmitting}
            />
          </div>

          <PurchaseItemsEditor
            items={items}
            products={products}
            dictionary={dictionary}
            disabled={isSubmitting}
            onChange={setItems}
          />

          {errors.items && (
            <p role="alert" className="text-sm text-danger">
              {errors.items}
            </p>
          )}

          <Input
            label={translate(dictionary, "suppliers.purchase.initialPayment")}
            name="initialPayment"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={initialPayment}
            onChange={(event) => setInitialPayment(event.target.value)}
            error={errors.initialPayment}
            helperText={translate(
              dictionary,
              "suppliers.purchase.initialPaymentHelper"
            )}
            disabled={isSubmitting}
          />
        </form>
      )}
    </Modal>
  );
}