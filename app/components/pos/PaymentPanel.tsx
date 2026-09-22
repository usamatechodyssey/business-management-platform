// app/components/pos/PaymentPanel.tsx
"use client";

import { useMemo, useState, type SubmitEvent } from "react";
import {
  Banknote,
  BookOpen,
  CreditCard,
  Split,
  UserPlus,
} from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { formatCurrency } from "@/lib/format";
import { translate, type Dictionary } from "@/lib/i18n";
import type { Customer, PaymentMethod } from "@/types";

interface PaymentPanelProps {
  total: number;
  customers: Customer[];
  dictionary: Dictionary;
  disabled?: boolean;
  onSubmit: (input: {
    paymentMethod: PaymentMethod;
    customerId?: string;
    amountPaid: number;
  }) => Promise<void>;
  onRequestQuickAddCustomer: () => void;
}

type MethodOption = {
  value: PaymentMethod;
  labelKey:
    | "pos.payment.methodCash"
    | "pos.payment.methodKhata"
    | "pos.payment.methodOnline"
    | "pos.payment.methodPartial";
  icon: typeof Banknote;
};

const METHODS: MethodOption[] = [
  { value: "cash", labelKey: "pos.payment.methodCash", icon: Banknote },
  { value: "khata", labelKey: "pos.payment.methodKhata", icon: BookOpen },
  { value: "online", labelKey: "pos.payment.methodOnline", icon: CreditCard },
  { value: "partial", labelKey: "pos.payment.methodPartial", icon: Split },
];

function todayInPKT(): string {
  const shifted = new Date(Date.now() + 5 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface FieldErrors {
  customerId?: string;
  amountPaid?: string;
  cashReceived?: string;
}

export function PaymentPanel({
  total,
  customers,
  dictionary,
  disabled = false,
  onSubmit,
  onRequestQuickAddCustomer,
}: PaymentPanelProps) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [customerId, setCustomerId] = useState("");
  const [amountPaidInput, setAmountPaidInput] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const needsCustomer = method === "khata" || method === "partial";

  // Sorted for the dropdown so the shopkeeper can find a regular quickly.
  const sortedCustomers = useMemo(
    () => [...customers].sort((a, b) => a.name.localeCompare(b.name)),
    [customers]
  );

  const cashReceivedNumber = Number(cashReceived);
  const change =
    method === "cash" &&
    cashReceived.trim() !== "" &&
    Number.isFinite(cashReceivedNumber)
      ? cashReceivedNumber - total
      : null;

  function handleMethodChange(next: PaymentMethod) {
    setMethod(next);
    setErrors({});
    // Reset method-specific inputs so a stale partial amount never leaks
    // into a cash sale and vice versa.
    setAmountPaidInput("");
    setCashReceived("");
    if (next === "cash" || next === "online") {
      setCustomerId("");
    }
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};

    if (needsCustomer && !customerId) {
      next.customerId = translate(
        dictionary,
        "pos.payment.errors.customerRequired"
      );
    }

    if (method === "partial") {
      const value = Number(amountPaidInput);
      if (amountPaidInput.trim() === "" || !Number.isFinite(value)) {
        next.amountPaid = translate(
          dictionary,
          "pos.payment.errors.amountPaidRequired"
        );
      } else if (value <= 0) {
        next.amountPaid = translate(
          dictionary,
          "pos.payment.errors.amountPaidTooLow"
        );
      } else if (value >= total) {
        next.amountPaid = translate(
          dictionary,
          "pos.payment.errors.amountPaidTooHigh"
        );
      }
    }

    // Cash-received is advisory: it only powers the change display, so we
    // don't block on it. If it's filled but less than the total, warn
    // without preventing submission.
    if (
      method === "cash" &&
      cashReceived.trim() !== "" &&
      Number.isFinite(cashReceivedNumber) &&
      cashReceivedNumber < total
    ) {
      next.cashReceived = translate(
        dictionary,
        "pos.payment.errors.amountPaidTooLow"
      );
    }

    return next;
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (isSubmitting || disabled) return;

    setErrors({});
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      // Per-method amount resolution:
      //   cash / online → server ignores, sets amountPaid = total
      //   khata        → server sets amountPaid = 0, amountDue = total
      //   partial      → we send the entered value
      const amountPaid =
        method === "partial" ? Number(amountPaidInput) : 0;

      await onSubmit({
        paymentMethod: method,
        customerId: customerId || undefined,
        amountPaid,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-4"
    >
      {/* Total — displayed at the top, prominent */}
      <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
        <span className="text-sm font-medium text-foreground">
          {translate(dictionary, "pos.payment.summaryLabel")}
        </span>
        <span className="text-xl font-bold text-primary tabular-nums">
          {formatCurrency(total)}
        </span>
      </div>

      {/* Method selector */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">
          {translate(dictionary, "pos.payment.methodLabel")}
        </span>
        <div
          role="radiogroup"
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {METHODS.map(({ value, labelKey, icon: Icon }) => {
            const isActive = method === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => handleMethodChange(value)}
                disabled={disabled || isSubmitting}
                className={[
                  "flex flex-col items-center justify-center gap-1 rounded-lg border py-2.5 text-xs font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface text-text-muted hover:bg-surface-muted",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {translate(dictionary, labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Customer picker — always shown for khata/partial; hidden for
          cash/online. Keeps the form short for the common case. */}
      {needsCustomer && (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="pos-customer-select"
            className="text-sm font-medium text-foreground"
          >
            {translate(dictionary, "pos.payment.customerLabel")}
            <span className="text-danger ms-1">*</span>
          </label>
          <div className="flex gap-2">
            <select
              id="pos-customer-select"
              value={customerId}
              onChange={(event) => {
                setCustomerId(event.target.value);
                if (errors.customerId) {
                  setErrors((prev) => ({ ...prev, customerId: undefined }));
                }
              }}
              disabled={disabled || isSubmitting}
              aria-invalid={!!errors.customerId}
              className={[
                "h-11 flex-1 rounded-lg border bg-surface px-3 text-base text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                "disabled:cursor-not-allowed disabled:opacity-60",
                errors.customerId ? "border-danger" : "border-border",
              ].join(" ")}
            >
              <option value="">
                {translate(dictionary, "pos.payment.selectCustomer")}
              </option>
              {sortedCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.phone}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onRequestQuickAddCustomer}
              disabled={disabled || isSubmitting}
              aria-label={translate(dictionary, "pos.payment.addNewCustomer")}
              title={translate(dictionary, "pos.payment.addNewCustomer")}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-text-muted transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          {errors.customerId && (
            <p role="alert" className="text-sm text-danger">
              {errors.customerId}
            </p>
          )}
        </div>
      )}

      {/* Cash received + change (advisory) */}
      {method === "cash" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label={translate(dictionary, "pos.payment.cashReceivedLabel")}
            name="cashReceived"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={cashReceived}
            onChange={(event) => setCashReceived(event.target.value)}
            error={errors.cashReceived}
            disabled={disabled || isSubmitting}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              {translate(dictionary, "pos.payment.changeLabel")}
            </span>
            <div className="flex h-11 items-center rounded-lg bg-surface-muted px-3 text-base font-semibold tabular-nums text-foreground">
              {change === null || change < 0
                ? "—"
                : formatCurrency(change)}
            </div>
          </div>
        </div>
      )}

      {/* Partial amount */}
      {method === "partial" && (
        <Input
          label={translate(dictionary, "pos.payment.amountPaidLabel")}
          name="amountPaid"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={amountPaidInput}
          onChange={(event) => setAmountPaidInput(event.target.value)}
          error={errors.amountPaid}
          helperText={translate(dictionary, "pos.payment.amountPaidHelper")}
          disabled={disabled || isSubmitting}
          required
        />
      )}

      <Button
        type="submit"
        variant="primary"
        fullWidth
        isLoading={isSubmitting}
        disabled={disabled}
      >
        {translate(dictionary, "pos.payment.submit")}
      </Button>

    </form>
  );
}