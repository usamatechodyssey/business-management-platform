// app/components/profit-fund/DisbursementModal.tsx
"use client";

import { useEffect, useState, type SubmitEvent } from "react";
import { Modal } from "@/app/components/ui/Modal";
import { Input } from "@/app/components/ui/Input";
import { Button } from "@/app/components/ui/Button";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { useToast } from "@/app/components/ui/Toast";
import { formatCurrency } from "@/lib/format";
import { translate, type Dictionary } from "@/lib/i18n";
import type { ProfitFundTierSnapshot } from "@/types";

interface DisbursementModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier: ProfitFundTierSnapshot;
  dictionary: Dictionary;
  onSuccess: () => void;
}

interface FormErrors {
  amount?: string;
  date?: string;
  note?: string;
}

function todayInPKT(): string {
  const shifted = new Date(Date.now() + 5 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function DisbursementModal({
  isOpen,
  onClose,
  tier,
  dictionary,
  onSuccess,
}: DisbursementModalProps) {
  const { push } = useToast();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayInPKT());
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Default the amount to the full available balance. Most disbursements
  // take everything out at once (pay out the charity pot, etc.).
  useEffect(() => {
    if (!isOpen) return;
    setAmount(tier.availableBalance > 0 ? String(tier.availableBalance) : "");
    setDate(todayInPKT());
    setNote("");
    setErrors({});
    setFormError(null);
  }, [isOpen, tier.id, tier.availableBalance]);

  const available = tier.availableBalance;

  function validate(): FormErrors {
    const next: FormErrors = {};

    const value = Number(amount);
    if (amount.trim() === "" || !Number.isFinite(value) || value <= 0) {
      next.amount = translate(
        dictionary,
        "profitFund.disbursement.errors.amountInvalid"
      );
    } else if (value > available) {
      next.amount = translate(
        dictionary,
        "profitFund.disbursement.errors.amountExceedsAvailable",
        { available: formatCurrency(available) }
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      next.date = translate(
        dictionary,
        "profitFund.disbursement.errors.dateInvalid"
      );
    }

    if (note.length > 200) {
      next.note = translate(
        dictionary,
        "profitFund.disbursement.errors.noteMax"
      );
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
        `/api/profit-fund-tiers/${tier.id}/disbursements`,
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
          message: translate(
            dictionary,
            "profitFund.disbursement.recorded"
          ),
          variant: "success",
        });
        onSuccess();
        return;
      }

      let responseBody: {
        error?: { code?: string; fields?: Record<string, string> };
      } | null = null;
      try {
        responseBody = (await response.json()) as {
          error?: { code?: string; fields?: Record<string, string> };
        };
      } catch {
        responseBody = null;
      }

      const code = responseBody?.error?.code;
      const fields = responseBody?.error?.fields;

      if (code === "INSUFFICIENT_BALANCE") {
        setErrors({
          amount: translate(
            dictionary,
            "profitFund.disbursement.errors.amountExceedsAvailable",
            {
              available: formatCurrency(
                Number(fields?.available ?? available)
              ),
            }
          ),
        });
        return;
      }
      if (code === "TIER_DISABLED") {
        setFormError(
          translate(
            dictionary,
            "profitFund.disbursement.errors.tierDisabled"
          )
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={translate(dictionary, "profitFund.disbursement.title", {
        name: tier.name,
      })}
      closeOnBackdropClick={!isSubmitting}
      footer={
        available <= 0 ? (
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
              form="disbursement-form"
              variant="primary"
              isLoading={isSubmitting}
            >
              {translate(dictionary, "profitFund.disbursement.submit")}
            </Button>
          </>
        )
      }
    >
      {available <= 0 ? (
        <EmptyState
          title={translate(dictionary, "profitFund.history.empty.title")}
          description={translate(
            dictionary,
            "profitFund.tier.rangeProfitMissing"
          )}
        />
      ) : (
        <form
          id="disbursement-form"
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
              {translate(dictionary, "profitFund.tier.availableBalance")}:{" "}
            </span>
            <span className="font-semibold text-foreground">
              {formatCurrency(available)}
            </span>
          </div>

          <Input
            label={translate(
              dictionary,
              "profitFund.disbursement.amountLabel"
            )}
            name="amount"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            error={errors.amount}
            helperText={translate(
              dictionary,
              "profitFund.disbursement.amountHelper",
              { amount: formatCurrency(available) }
            )}
            disabled={isSubmitting}
            required
          />

          <Input
            label={translate(
              dictionary,
              "profitFund.disbursement.dateLabel"
            )}
            name="date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            error={errors.date}
            disabled={isSubmitting}
            required
          />

          <Input
            label={translate(
              dictionary,
              "profitFund.disbursement.noteLabel"
            )}
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