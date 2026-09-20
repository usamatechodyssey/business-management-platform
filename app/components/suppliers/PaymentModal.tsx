// app/components/suppliers/PaymentModal.tsx
"use client";

import { useEffect, useMemo, useState, type SubmitEvent } from "react";
import { Modal } from "@/app/components/ui/Modal";
import { Input } from "@/app/components/ui/Input";
import { Button } from "@/app/components/ui/Button";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { useToast } from "@/app/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/format";
import { translate, type Dictionary } from "@/lib/i18n";
import type { Purchase, Supplier } from "@/types";
import { Loader } from "@/app/components/ui/Loader";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier;
  purchases: Purchase[];
  initialPurchaseId?: string;
  dictionary: Dictionary;
  onSuccess: () => void;
  // True while the parent is fetching this supplier's purchases. Prevents
  // a flash of the "nothing to pay" empty state on open.
  isLoading?: boolean;
}

interface FormErrors {
  purchaseId?: string;
  amount?: string;
  date?: string;
  note?: string;
}

// Same PKT-safe today helper as PurchaseFormModal. Kept local so each
// modal owns its own date default without a shared util (one-liner).
function todayInPKT(): string {
  const shifted = new Date(Date.now() + 5 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function PaymentModal({
  isOpen,
  onClose,
  supplier,
  purchases,
  initialPurchaseId,
  dictionary,
  onSuccess,
  isLoading = false,
}: PaymentModalProps) {
  const { push } = useToast();

  // Only purchases with a remaining balance can receive a payment.
  const unpaidPurchases = useMemo(
    () =>
      purchases
        .filter((p) => p.totalCost - p.amountPaid > 0)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [purchases]
  );

  const [purchaseId, setPurchaseId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayInPKT());
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset each time the modal opens. When `initialPurchaseId` is given
  // and still unpaid, prefer it; otherwise fall back to the oldest
  // outstanding purchase (FIFO by date descending as shown in the list).
  useEffect(() => {
    if (!isOpen) return;
    const preferred = initialPurchaseId
      ? unpaidPurchases.find((p) => p.id === initialPurchaseId)
      : undefined;
    const fallback = unpaidPurchases[0];
    const chosen = preferred ?? fallback;
    setPurchaseId(chosen?.id ?? "");
    setAmount(chosen ? String(chosen.totalCost - chosen.amountPaid) : "");
    setDate(todayInPKT());
    setNote("");
    setErrors({});
    setFormError(null);
  }, [isOpen, initialPurchaseId, unpaidPurchases]);

  const selectedPurchase = unpaidPurchases.find((p) => p.id === purchaseId);
  const outstanding = selectedPurchase
    ? selectedPurchase.totalCost - selectedPurchase.amountPaid
    : 0;

  function validate(): FormErrors {
    const next: FormErrors = {};

    if (!purchaseId) {
      next.purchaseId = translate(
        dictionary,
        "suppliers.payment.errors.purchaseRequired"
      );
    }

    const value = Number(amount);
    if (amount.trim() === "" || !Number.isFinite(value) || value <= 0) {
      next.amount = translate(
        dictionary,
        "suppliers.payment.errors.amountInvalid"
      );
    } else if (value > outstanding) {
      next.amount = translate(
        dictionary,
        "suppliers.payment.errors.amountExceedsOutstanding"
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      next.date = translate(dictionary, "suppliers.payment.errors.dateInvalid");
    }

    if (note.length > 200) {
      next.note = translate(dictionary, "suppliers.payment.errors.noteMax");
    }

    return next;
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (isSubmitting) return;

    setFormError(null);
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/suppliers/${supplier.id}/payments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            purchaseId,
            amount: Number(amount),
            date,
            note: note.trim(),
          }),
        }
      );

      if (response.ok) {
        push({
          message: translate(dictionary, "suppliers.payment.recorded"),
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

      if (responseBody?.error?.code === "INVALID_PAYMENT_AMOUNT") {
        setErrors({
          amount: translate(
            dictionary,
            "suppliers.payment.errors.amountExceedsOutstanding"
          ),
        });
        return;
      }
      if (responseBody?.error?.code === "PURCHASE_NOT_FOUND") {
        setErrors({
          purchaseId: translate(
            dictionary,
            "suppliers.payment.errors.purchaseRequired"
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
      title={translate(dictionary, "suppliers.payment.title")}
      closeOnBackdropClick={!isSubmitting}
       footer={
        unpaidPurchases.length === 0 && !isLoading ? (
          <Button type="button" variant="secondary" onClick={onClose}>
            {translate(dictionary, "common.close")}
          </Button>
        ): (
          <>
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
              form="payment-form"
              variant="primary"
              isLoading={isSubmitting}
            >
              {translate(dictionary, "suppliers.payment.recordButton")}
            </Button>
          </>
        )
      }
    >
   {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader />
        </div>
      ) : unpaidPurchases.length === 0 ? (
        <EmptyState
          title={translate(dictionary, "suppliers.payment.empty.title")}
          description={translate(
            dictionary,
            "suppliers.payment.empty.description"
          )}
        />
      ) : (
        <form
          id="payment-form"
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

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              {translate(dictionary, "suppliers.payment.purchaseLabel")}
            </span>
            <select
              value={purchaseId}
              onChange={(event) => {
                setPurchaseId(event.target.value);
                const p = unpaidPurchases.find(
                  (item) => item.id === event.target.value
                );
                if (p) {
                  setAmount(String(p.totalCost - p.amountPaid));
                }
              }}
              disabled={isSubmitting}
              aria-invalid={!!errors.purchaseId}
              className={[
                "h-11 rounded-lg border bg-surface px-3 text-base text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                "disabled:cursor-not-allowed disabled:opacity-60",
                errors.purchaseId ? "border-danger" : "border-border",
              ].join(" ")}
            >
              {unpaidPurchases.map((p) => (
                <option key={p.id} value={p.id}>
                  {formatDate(p.date)} — {formatCurrency(p.totalCost)} (
                  {formatCurrency(p.totalCost - p.amountPaid)} due)
                </option>
              ))}
            </select>
            {errors.purchaseId && (
              <p role="alert" className="text-sm text-danger">
                {errors.purchaseId}
              </p>
            )}
          </label>

          <Input
            label={translate(dictionary, "suppliers.payment.amount")}
            name="amount"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            error={errors.amount}
            helperText={
              selectedPurchase
                ? translate(dictionary, "suppliers.payment.amountHelper", {
                    amount: formatCurrency(outstanding),
                  })
                : undefined
            }
            disabled={isSubmitting}
            required
          />

          <Input
            label={translate(dictionary, "suppliers.payment.date")}
            name="date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            error={errors.date}
            disabled={isSubmitting}
            required
          />

          <Input
            label={translate(dictionary, "suppliers.payment.note")}
            name="note"
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            error={errors.note}
            helperText={translate(dictionary, "common.optional")}
            disabled={isSubmitting}
          />
        </form>
      )}
    </Modal>
  );
}