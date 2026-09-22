// app/components/customers/PaymentRecordModal.tsx
"use client";

import { useEffect, useState, type SubmitEvent } from "react";
import { Modal } from "@/app/components/ui/Modal";
import { Input } from "@/app/components/ui/Input";
import { Button } from "@/app/components/ui/Button";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { useToast } from "@/app/components/ui/Toast";
import { formatCurrency } from "@/lib/format";
import { translate, type Dictionary } from "@/lib/i18n";
import type { Customer } from "@/types";

interface PaymentRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  dictionary: Dictionary;
  onSuccess: () => void;
}

interface FormErrors {
  amount?: string;
  date?: string;
  note?: string;
}

// Same PKT-safe today helper as the other modal helpers. Local because
// it's a one-liner; if a third modal needs it, extract to lib/format.ts.
function todayInPKT(): string {
  const shifted = new Date(Date.now() + 5 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function PaymentRecordModal({
  isOpen,
  onClose,
  customer,
  dictionary,
  onSuccess,
}: PaymentRecordModalProps) {
  const { push } = useToast();

  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayInPKT());
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset every open. Default the amount to the full outstanding balance —
  // most real-world khata payments settle the balance in one go.
  useEffect(() => {
    if (!isOpen) return;
    setAmount(customer.totalDue > 0 ? String(customer.totalDue) : "");
    setDate(todayInPKT());
    setNote("");
    setErrors({});
    setFormError(null);
  }, [isOpen, customer.id, customer.totalDue]);

  const outstanding = customer.totalDue;

  function validate(): FormErrors {
    const next: FormErrors = {};

    const value = Number(amount);
    if (amount.trim() === "" || !Number.isFinite(value) || value <= 0) {
      next.amount = translate(
        dictionary,
        "customers.payment.errors.amountInvalid"
      );
    } else if (value > outstanding) {
      next.amount = translate(
        dictionary,
        "customers.payment.errors.amountExceedsOutstanding"
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      next.date = translate(
        dictionary,
        "customers.payment.errors.dateInvalid"
      );
    }

    if (note.length > 200) {
      next.note = translate(dictionary, "customers.payment.errors.noteMax");
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
        `/api/customers/${customer.id}/ledger`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: Number(amount),
            date,
            note: note.trim(),
          }),
        }
      );

      if (response.ok) {
        push({
          message: translate(dictionary, "customers.payment.recorded"),
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
            "customers.payment.errors.amountExceedsOutstanding"
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
      title={translate(dictionary, "customers.payment.title")}
      closeOnBackdropClick={!isSubmitting}
      footer={
        outstanding <= 0 ? (
          <Button type="button" variant="secondary" onClick={onClose}>
            {translate(dictionary, "common.close")}
          </Button>
        ) : (
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
              form="customer-payment-form"
              variant="primary"
              isLoading={isSubmitting}
            >
              {translate(dictionary, "customers.payment.recordButton")}
            </Button>
          </>
        )
      }
    >
      {outstanding <= 0 ? (
        <EmptyState
          title={translate(dictionary, "customers.payment.empty.title")}
          description={translate(
            dictionary,
            "customers.payment.empty.description"
          )}
        />
      ) : (
        <form
          id="customer-payment-form"
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
              {translate(dictionary, "customers.fields.name")}:{" "}
            </span>
            <span className="font-medium text-foreground">
              {customer.name}
            </span>
          </div>

          <Input
            label={translate(dictionary, "customers.payment.amount")}
            name="amount"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            error={errors.amount}
            helperText={translate(dictionary, "customers.payment.amountHelper", {
              amount: formatCurrency(outstanding),
            })}
            disabled={isSubmitting}
            required
          />

          <Input
            label={translate(dictionary, "customers.payment.date")}
            name="date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            error={errors.date}
            disabled={isSubmitting}
            required
          />

          <Input
            label={translate(dictionary, "customers.payment.note")}
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