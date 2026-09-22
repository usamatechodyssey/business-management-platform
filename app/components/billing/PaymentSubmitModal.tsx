// app/components/billing/PaymentSubmitModal.tsx
"use client";

import { useEffect, useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/app/components/ui/Modal";
import { Input } from "@/app/components/ui/Input";
import { Button } from "@/app/components/ui/Button";
import { useToast } from "@/app/components/ui/Toast";
import { formatCurrency } from "@/lib/format";
import { MONTH_OPTIONS, calculateAmount } from "@/lib/pricing";
import { translate, type Dictionary } from "@/lib/i18n";
import type { BillingMethod, PlanTier } from "@/types";

interface PaymentSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  plans: PlanTier[];
  // When set (from /billing/plans → /billing?plan=SLUG), the modal opens
  // with this plan preselected. Null means "no preference, use first".
  initialPlanSlug?: string | null;
  platformInfo: {
    displayName: string;
    jazzcash: string | null;
    easypaisa: string | null;
    bank: string | null;
  };
  dictionary: Dictionary;
}

interface FormErrors {
  transactionId?: string;
  paidAt?: string;
  notes?: string;
}

function todayInPKT(): string {
  const shifted = new Date(Date.now() + 5 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function PaymentSubmitModal({
  isOpen,
  onClose,
  plans,
  initialPlanSlug,
  platformInfo,
  dictionary,
}: PaymentSubmitModalProps) {
  const router = useRouter();
  const { push } = useToast();

  const [planSlug, setPlanSlug] = useState<string>("");
  const [months, setMonths] = useState<number>(1);
  const [method, setMethod] = useState<BillingMethod>("jazzcash");
  const [transactionId, setTransactionId] = useState("");
  const [paidAt, setPaidAt] = useState(todayInPKT());
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const preferred =
      initialPlanSlug && plans.some((p) => p.slug === initialPlanSlug)
        ? initialPlanSlug
        : (plans[0]?.slug ?? "");
    setPlanSlug(preferred);
    setMonths(1);
    setMethod("jazzcash");
    setTransactionId("");
    setPaidAt(todayInPKT());
    setNotes("");
    setErrors({});
    setFormError(null);
  }, [isOpen, plans, initialPlanSlug]);

  const selectedPlan = plans.find((p) => p.slug === planSlug);
  const priceMonthly = selectedPlan?.priceMonthly ?? 0;
  const total = calculateAmount(priceMonthly, months);

  function validate(): FormErrors {
    const next: FormErrors = {};
    if (!transactionId.trim()) {
      next.transactionId = translate(
        dictionary,
        "billing.submit.errors.transactionIdRequired"
      );
    } else if (transactionId.length > 50) {
      next.transactionId = translate(
        dictionary,
        "billing.submit.errors.transactionIdMax"
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidAt)) {
      next.paidAt = translate(
        dictionary,
        "billing.submit.errors.paidAtInvalid"
      );
    }
    if (notes.length > 300) {
      next.notes = translate(dictionary, "billing.submit.errors.notesMax");
    }
    return next;
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (isSubmitting) return;

    setFormError(null);
    if (!planSlug) {
      setFormError(
        translate(dictionary, "billing.submit.errors.planRequired")
      );
      return;
    }

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/billing/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planSlug,
          months,
          method,
          transactionId: transactionId.trim(),
          paidAt,
          notes: notes.trim(),
        }),
      });

      if (response.ok) {
        push({
          message: translate(dictionary, "billing.submit.submitted"),
          variant: "success",
        });
        onClose();
        router.refresh();
        return;
      }

      let body: { error?: { code?: string } } | null = null;
      try {
        body = (await response.json()) as { error?: { code?: string } };
      } catch {
        body = null;
      }

      if (body?.error?.code === "TOO_MANY_PENDING") {
        setFormError(
          translate(dictionary, "billing.submit.errors.tooManyPending")
        );
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

  // Payment instructions — only channels that are configured.
  const channels: {
    key: "jazzcash" | "easypaisa" | "bank";
    label: string;
    value: string;
  }[] = [];
  if (platformInfo.jazzcash) {
    channels.push({
      key: "jazzcash",
      label: translate(dictionary, "billing.submit.methodJazzcash"),
      value: platformInfo.jazzcash,
    });
  }
  if (platformInfo.easypaisa) {
    channels.push({
      key: "easypaisa",
      label: translate(dictionary, "billing.submit.methodEasypaisa"),
      value: platformInfo.easypaisa,
    });
  }
  if (platformInfo.bank) {
    channels.push({
      key: "bank",
      label: translate(dictionary, "billing.submit.methodBank"),
      value: platformInfo.bank,
    });
  }

  const showInstructions = channels.length > 0 && total > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={translate(dictionary, "billing.submit.title")}
      closeOnBackdropClick={!isSubmitting}
      footer={
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
            form="payment-submit-form"
            variant="primary"
            isLoading={isSubmitting}
          >
            {translate(dictionary, "billing.submit.submit")}
          </Button>
        </>
      }
    >
      <form
        id="payment-submit-form"
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col gap-4"
      >
        <p className="text-sm text-text-muted">
          {translate(dictionary, "billing.submit.description")}
        </p>

        {formError && (
          <div
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            {formError}
          </div>
        )}

        {/* Plan picker — dynamic from DB */}
        <fieldset>
          <legend className="text-sm font-medium text-foreground">
            {translate(dictionary, "billing.submit.planLabel")}
          </legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {plans.map((p) => {
              const isActive = planSlug === p.slug;
              return (
                <button
                  key={p.slug}
                  type="button"
                  onClick={() => setPlanSlug(p.slug)}
                  aria-pressed={isActive}
                  disabled={isSubmitting}
                  className={[
                    "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-surface text-text-muted hover:bg-surface-muted",
                  ].join(" ")}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Months picker */}
        <fieldset>
          <legend className="text-sm font-medium text-foreground">
            {translate(dictionary, "billing.submit.monthsLabel")}
          </legend>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {MONTH_OPTIONS.map((m) => {
              const labelKey =
                m === 1
                  ? "billing.submit.monthsOne"
                  : m === 3
                    ? "billing.submit.monthsThree"
                    : m === 6
                      ? "billing.submit.monthsSix"
                      : "billing.submit.monthsTwelve";
              const isActive = months === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonths(m)}
                  aria-pressed={isActive}
                  disabled={isSubmitting}
                  className={[
                    "rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-surface text-text-muted hover:bg-surface-muted",
                  ].join(" ")}
                >
                  {translate(dictionary, labelKey)}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Amount summary */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-3 text-center">
          <p className="text-xs text-text-muted">
            {translate(dictionary, "billing.submit.amountLabel")}
          </p>
          <p className="mt-1 text-lg font-bold text-primary">
            {formatCurrency(total)}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            {translate(dictionary, "billing.submit.amountFormula", {
              monthly: formatCurrency(priceMonthly),
              months,
              total: formatCurrency(total),
            })}
          </p>
        </div>

        {/* Payment instructions — where to send money */}
        {showInstructions && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-warning">
              {translate(dictionary, "billing.submit.instructionsTitle")}
            </p>
            <p className="mt-1 text-sm text-foreground">
              {translate(dictionary, "billing.submit.instructionsBody", {
                amount: formatCurrency(total),
                displayName: platformInfo.displayName,
              })}
            </p>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {channels.map((c) => (
                <li
                  key={c.key}
                  className="flex flex-wrap items-baseline gap-2"
                >
                  <span className="font-medium text-foreground">
                    {c.label}:
                  </span>
                  <span className="font-mono text-foreground">{c.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Payment method */}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">
            {translate(dictionary, "billing.submit.methodLabel")}
          </span>
          <select
            value={method}
            onChange={(event) => setMethod(event.target.value as BillingMethod)}
            disabled={isSubmitting}
            className="h-11 rounded-lg border border-border bg-surface px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <option value="jazzcash">
              {translate(dictionary, "billing.submit.methodJazzcash")}
            </option>
            <option value="easypaisa">
              {translate(dictionary, "billing.submit.methodEasypaisa")}
            </option>
            <option value="bank">
              {translate(dictionary, "billing.submit.methodBank")}
            </option>
            <option value="other">
              {translate(dictionary, "billing.submit.methodOther")}
            </option>
          </select>
        </label>

        <Input
          label={translate(dictionary, "billing.submit.transactionIdLabel")}
          name="transactionId"
          type="text"
          value={transactionId}
          onChange={(event) => setTransactionId(event.target.value)}
          error={errors.transactionId}
          helperText={translate(
            dictionary,
            "billing.submit.transactionIdHelper"
          )}
          disabled={isSubmitting}
          required
        />

        <Input
          label={translate(dictionary, "billing.submit.paidAtLabel")}
          name="paidAt"
          type="date"
          value={paidAt}
          onChange={(event) => setPaidAt(event.target.value)}
          error={errors.paidAt}
          disabled={isSubmitting}
          required
        />

        <Input
          label={translate(dictionary, "billing.submit.notesLabel")}
          name="notes"
          type="text"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          error={errors.notes}
          helperText={translate(dictionary, "billing.submit.notesHelper")}
          disabled={isSubmitting}
        />
      </form>
    </Modal>
  );
}