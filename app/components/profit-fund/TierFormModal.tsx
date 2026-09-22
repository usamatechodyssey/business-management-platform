// app/components/profit-fund/TierFormModal.tsx
"use client";

import { useEffect, useState, type SubmitEvent } from "react";
import { Modal } from "@/app/components/ui/Modal";
import { Input } from "@/app/components/ui/Input";
import { Button } from "@/app/components/ui/Button";
import { useToast } from "@/app/components/ui/Toast";
import { formatCurrency } from "@/lib/format";
import { translate, type Dictionary } from "@/lib/i18n";
import type { ProfitFundTier } from "@/types";

interface TierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  // null → create mode. Non-null → edit mode.
  tier: ProfitFundTier | null;
  // Range profit (in rupees) that drives the live preview. Comes from the
  // page's currently selected range so the preview matches what the user
  // sees behind the modal.
  rangeProfit: number;
  dictionary: Dictionary;
  onSuccess: () => void;
}

interface FormState {
  name: string;
  percentage: string;
  enabled: boolean;
}

interface FieldErrors {
  name?: string;
  percentage?: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  percentage: "",
  enabled: true,
};

function tierToForm(tier: ProfitFundTier): FormState {
  return {
    name: tier.name,
    percentage: String(tier.percentage),
    enabled: tier.enabled,
  };
}

export function TierFormModal({
  isOpen,
  onClose,
  tier,
  rangeProfit,
  dictionary,
  onSuccess,
}: TierFormModalProps) {
  const { push } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEdit = tier !== null;

  useEffect(() => {
    if (!isOpen) return;
    setForm(tier ? tierToForm(tier) : EMPTY_FORM);
    setErrors({});
    setFormError(null);
  }, [isOpen, tier]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};

    const name = form.name.trim();
    if (!name) {
      next.name = translate(dictionary, "profitFund.errors.nameRequired");
    } else if (name.length > 50) {
      next.name = translate(dictionary, "profitFund.errors.nameMax");
    }

    const percentage = Number(form.percentage);
    if (
      form.percentage.trim() === "" ||
      !Number.isFinite(percentage) ||
      percentage <= 0 ||
      percentage > 100
    ) {
      next.percentage = translate(
        dictionary,
        "profitFund.errors.percentageInvalid"
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

    const payload = {
      name: form.name.trim(),
      percentage: Number(form.percentage),
      enabled: form.enabled,
    };

    try {
      const url = isEdit
        ? `/api/profit-fund-tiers/${tier.id}`
        : "/api/profit-fund-tiers";
      const method = isEdit ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        push({
          message: translate(
            dictionary,
            isEdit ? "profitFund.updated" : "profitFund.created"
          ),
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

      if (responseBody?.error?.code === "TIER_NAME_TAKEN") {
        setErrors({
          name: translate(dictionary, "profitFund.errors.nameTaken"),
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

  // Live preview — the pitch feature. "X% of Rs. Y = Rs. Z".
  const percentageNumber = Number(form.percentage);
  const showPreview =
    Number.isFinite(percentageNumber) &&
    percentageNumber > 0 &&
    percentageNumber <= 100;
  const previewAmount = showPreview
    ? Math.round((rangeProfit * percentageNumber) / 100)
    : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={translate(
        dictionary,
        isEdit ? "profitFund.form.editTitle" : "profitFund.form.createTitle"
      )}
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
            form="tier-form"
            variant="primary"
            isLoading={isSubmitting}
          >
            {translate(dictionary, "common.save")}
          </Button>
        </>
      }
    >
      <form
        id="tier-form"
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

        <Input
          label={translate(dictionary, "profitFund.form.nameLabel")}
          name="name"
          type="text"
          value={form.name}
          onChange={(event) => update("name", event.target.value)}
          error={errors.name}
          helperText={translate(dictionary, "profitFund.form.nameHelper")}
          placeholder={translate(
            dictionary,
            "profitFund.form.namePlaceholder"
          )}
          autoFocus
          required
          disabled={isSubmitting}
        />

        <Input
          label={translate(dictionary, "profitFund.form.percentageLabel")}
          name="percentage"
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step="0.01"
          value={form.percentage}
          onChange={(event) => update("percentage", event.target.value)}
          error={errors.percentage}
          helperText={translate(
            dictionary,
            "profitFund.form.percentageHelper"
          )}
          required
          disabled={isSubmitting}
        />

        {/* Live preview — the emotional core of the module */}
        {showPreview && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-center">
            <p className="text-sm font-medium text-primary">
              {percentageNumber}% × {formatCurrency(rangeProfit)} ={" "}
              <span className="font-bold">
                {formatCurrency(previewAmount)}
              </span>
            </p>
          </div>
        )}

        <label className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) => update("enabled", event.target.checked)}
            disabled={isSubmitting}
            className="mt-0.5 h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              {translate(dictionary, "profitFund.form.enabledLabel")}
            </p>
            <p className="text-xs text-text-muted">
              {translate(dictionary, "profitFund.form.enabledHelper")}
            </p>
          </div>
        </label>
      </form>
    </Modal>
  );
}