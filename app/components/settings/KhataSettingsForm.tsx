// app/components/settings/KhataSettingsForm.tsx
"use client";

import { useEffect, useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/app/components/ui/Input";
import { Button } from "@/app/components/ui/Button";
import { useToast } from "@/app/components/ui/Toast";
import { translate, type Dictionary } from "@/lib/i18n";
import { REMINDER_PLACEHOLDERS } from "@/lib/whatsapp";
import type { Business,  KhataSettings } from "@/types";

interface KhataSettingsFormProps {
  business: Business;
  dictionary: Dictionary;
}

interface FormState {
  creditLimitEnabled: boolean;
  defaultCreditLimit: string;
  blockSaleOnLimitExceeded: boolean;
  dueDateTrackingEnabled: boolean;
  defaultPaymentTermsDays: string;
  guarantorEnabled: boolean;
  customerTagsEnabled: boolean;
  allowPartialPayments: boolean;
  requireCustomerPhoneForCredit: boolean;
  reminderTemplateUrdu: string;
  reminderTemplateEnglish: string;
  defaultReminderLanguage: "ur" | "en";
  lowStockThreshold: string;
}

interface FieldErrors {
  lowStockThreshold?: string;
  defaultCreditLimit?: string;
  defaultPaymentTermsDays?: string;
  reminderTemplateUrdu?: string;
  reminderTemplateEnglish?: string;
}

function toForm(b: Business): FormState {
  const k = b.settings.khataSettings;
  return {
    creditLimitEnabled: k.creditLimitEnabled,
    defaultCreditLimit: String(k.defaultCreditLimit),
    blockSaleOnLimitExceeded: k.blockSaleOnLimitExceeded,
    dueDateTrackingEnabled: k.dueDateTrackingEnabled,
    defaultPaymentTermsDays: String(k.defaultPaymentTermsDays),
    guarantorEnabled: k.guarantorEnabled,
    customerTagsEnabled: k.customerTagsEnabled,
    allowPartialPayments: k.allowPartialPayments,
    requireCustomerPhoneForCredit: k.requireCustomerPhoneForCredit,
    reminderTemplateUrdu: k.reminderTemplateUrdu,
    reminderTemplateEnglish: k.reminderTemplateEnglish,
    defaultReminderLanguage: k.defaultReminderLanguage,
    lowStockThreshold: String(b.settings.lowStockThreshold),
  };
}

// Renders a labelled toggle row that visually matches the rest of the
// forms. Native checkbox keeps it accessible by default.
function ToggleRow({
  label,
  helper,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  helper?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface p-3 transition-colors hover:bg-surface-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {helper && <p className="mt-0.5 text-xs text-text-muted">{helper}</p>}
      </div>
    </label>
  );
}

export function KhataSettingsForm({
  business,
  dictionary,
}: KhataSettingsFormProps) {
  const router = useRouter();
  const { push } = useToast();

  const [form, setForm] = useState<FormState>(toForm(business));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setForm(toForm(business));
    setErrors({});
    setFormError(null);
  }, [business]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};

    const lowStock = Number(form.lowStockThreshold);
    if (
      form.lowStockThreshold.trim() === "" ||
      !Number.isFinite(lowStock) ||
      lowStock < 0 ||
      !Number.isInteger(lowStock)
    ) {
      next.lowStockThreshold = translate(
        dictionary,
        "settings.errors.lowStockThresholdInvalid"
      );
    }

    if (form.creditLimitEnabled) {
      const limit = Number(form.defaultCreditLimit);
      if (
        form.defaultCreditLimit.trim() === "" ||
        !Number.isFinite(limit) ||
        limit < 0
      ) {
        next.defaultCreditLimit = translate(
          dictionary,
          "settings.errors.creditLimitInvalid"
        );
      }
    }

    if (form.dueDateTrackingEnabled) {
      const days = Number(form.defaultPaymentTermsDays);
      if (
        form.defaultPaymentTermsDays.trim() === "" ||
        !Number.isFinite(days) ||
        days < 0 ||
        !Number.isInteger(days)
      ) {
        next.defaultPaymentTermsDays = translate(
          dictionary,
          "settings.errors.paymentTermsInvalid"
        );
      }
    }

    if (form.reminderTemplateEnglish.length > 500) {
      next.reminderTemplateEnglish = translate(
        dictionary,
        "settings.errors.templateTooLong"
      );
    }
    if (form.reminderTemplateUrdu.length > 500) {
      next.reminderTemplateUrdu = translate(
        dictionary,
        "settings.errors.templateTooLong"
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

    const khataSettings: KhataSettings = {
      creditLimitEnabled: form.creditLimitEnabled,
      defaultCreditLimit: Number(form.defaultCreditLimit) || 0,
      blockSaleOnLimitExceeded: form.blockSaleOnLimitExceeded,
      dueDateTrackingEnabled: form.dueDateTrackingEnabled,
      defaultPaymentTermsDays: Number(form.defaultPaymentTermsDays) || 0,
      guarantorEnabled: form.guarantorEnabled,
      customerTagsEnabled: form.customerTagsEnabled,
      allowPartialPayments: form.allowPartialPayments,
      requireCustomerPhoneForCredit: form.requireCustomerPhoneForCredit,
      reminderTemplateUrdu: form.reminderTemplateUrdu,
      reminderTemplateEnglish: form.reminderTemplateEnglish,
      defaultReminderLanguage: form.defaultReminderLanguage,
    };

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            lowStockThreshold: Number(form.lowStockThreshold),
            // Preserve whatever's currently stored — currency is not
            // client-editable and the API ignores it anyway.
            language: business.settings.language,
            khataSettings,
          },
        }),
      });

      if (response.ok) {
        push({
          message: translate(dictionary, "settings.saved"),
          variant: "success",
        });
        router.refresh();
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

  const placeholderList = REMINDER_PLACEHOLDERS.map(
    (p) => `{{${p}}}`
  ).join(", ");

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {formError && (
        <div
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {formError}
        </div>
      )}

      {/* Low stock — technically inventory, but it's a "numbers that
          govern behaviour" setting and lives more naturally beside the
          khata thresholds than in its own tab. */}
      <Input
        label="Low stock threshold"
        name="lowStockThreshold"
        type="number"
        inputMode="numeric"
        min={0}
        value={form.lowStockThreshold}
        onChange={(event) => update("lowStockThreshold", event.target.value)}
        error={errors.lowStockThreshold}
        disabled={isSubmitting}
        required
      />

      {/* Credit limit block */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <ToggleRow
          label={translate(
            dictionary,
            "settings.khata.creditLimitEnabled"
          )}
          helper={translate(
            dictionary,
            "settings.khata.creditLimitEnabledHelper"
          )}
          checked={form.creditLimitEnabled}
          onChange={(v) => update("creditLimitEnabled", v)}
          disabled={isSubmitting}
        />

        {form.creditLimitEnabled && (
          <>
            <Input
              label={translate(
                dictionary,
                "settings.khata.defaultCreditLimit"
              )}
              name="defaultCreditLimit"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={form.defaultCreditLimit}
              onChange={(event) =>
                update("defaultCreditLimit", event.target.value)
              }
              error={errors.defaultCreditLimit}
              helperText={translate(
                dictionary,
                "settings.khata.defaultCreditLimitHelper"
              )}
              disabled={isSubmitting}
            />

            <ToggleRow
              label={translate(
                dictionary,
                "settings.khata.blockSaleOnLimitExceeded"
              )}
              helper={translate(
                dictionary,
                "settings.khata.blockSaleOnLimitExceededHelper"
              )}
              checked={form.blockSaleOnLimitExceeded}
              onChange={(v) => update("blockSaleOnLimitExceeded", v)}
              disabled={isSubmitting}
            />
          </>
        )}
      </div>

      {/* Due date block */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <ToggleRow
          label={translate(
            dictionary,
            "settings.khata.dueDateTrackingEnabled"
          )}
          helper={translate(
            dictionary,
            "settings.khata.dueDateTrackingEnabledHelper"
          )}
          checked={form.dueDateTrackingEnabled}
          onChange={(v) => update("dueDateTrackingEnabled", v)}
          disabled={isSubmitting}
        />

        {form.dueDateTrackingEnabled && (
          <Input
            label={translate(
              dictionary,
              "settings.khata.defaultPaymentTermsDays"
            )}
            name="defaultPaymentTermsDays"
            type="number"
            inputMode="numeric"
            min={0}
            value={form.defaultPaymentTermsDays}
            onChange={(event) =>
              update("defaultPaymentTermsDays", event.target.value)
            }
            error={errors.defaultPaymentTermsDays}
            helperText={translate(
              dictionary,
              "settings.khata.defaultPaymentTermsDaysHelper"
            )}
            disabled={isSubmitting}
          />
        )}
      </div>

      {/* Simple toggles */}
      <div className="flex flex-col gap-3">
        <ToggleRow
          label={translate(dictionary, "settings.khata.guarantorEnabled")}
          helper={translate(
            dictionary,
            "settings.khata.guarantorEnabledHelper"
          )}
          checked={form.guarantorEnabled}
          onChange={(v) => update("guarantorEnabled", v)}
          disabled={isSubmitting}
        />
        <ToggleRow
          label={translate(
            dictionary,
            "settings.khata.customerTagsEnabled"
          )}
          helper={translate(
            dictionary,
            "settings.khata.customerTagsEnabledHelper"
          )}
          checked={form.customerTagsEnabled}
          onChange={(v) => update("customerTagsEnabled", v)}
          disabled={isSubmitting}
        />
        <ToggleRow
          label={translate(
            dictionary,
            "settings.khata.allowPartialPayments"
          )}
          helper={translate(
            dictionary,
            "settings.khata.allowPartialPaymentsHelper"
          )}
          checked={form.allowPartialPayments}
          onChange={(v) => update("allowPartialPayments", v)}
          disabled={isSubmitting}
        />
        <ToggleRow
          label={translate(
            dictionary,
            "settings.khata.requireCustomerPhoneForCredit"
          )}
          helper={translate(
            dictionary,
            "settings.khata.requireCustomerPhoneForCreditHelper"
          )}
          checked={form.requireCustomerPhoneForCredit}
          onChange={(v) => update("requireCustomerPhoneForCredit", v)}
          disabled={isSubmitting}
        />
      </div>

      {/* Reminder templates */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {translate(dictionary, "settings.khata.reminderTemplates")}
          </h3>
          <p className="mt-0.5 text-xs text-text-muted">
            {translate(
              dictionary,
              "settings.khata.reminderTemplatesDescription"
            )}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {translate(
              dictionary,
              "settings.khata.templatePlaceholdersHint",
              { list: placeholderList }
            )}
          </p>
        </div>

        {/* English template */}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">
            {translate(
              dictionary,
              "settings.khata.templateEnglishLabel"
            )}
          </span>
          <textarea
            value={form.reminderTemplateEnglish}
            onChange={(event) =>
              update("reminderTemplateEnglish", event.target.value)
            }
            disabled={isSubmitting}
            rows={3}
            dir="ltr"
            className={[
              "w-full rounded-lg border bg-surface px-3 py-2 text-sm text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              "disabled:cursor-not-allowed disabled:opacity-60",
              "resize-y",
              errors.reminderTemplateEnglish
                ? "border-danger"
                : "border-border",
            ].join(" ")}
          />
          {errors.reminderTemplateEnglish && (
            <p role="alert" className="text-sm text-danger">
              {errors.reminderTemplateEnglish}
            </p>
          )}
        </label>

        {/* Urdu template */}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">
            {translate(dictionary, "settings.khata.templateUrduLabel")}
          </span>
          <textarea
            value={form.reminderTemplateUrdu}
            onChange={(event) =>
              update("reminderTemplateUrdu", event.target.value)
            }
            disabled={isSubmitting}
            rows={3}
            dir="rtl"
            className={[
              "w-full rounded-lg border bg-surface px-3 py-2 text-sm text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              "disabled:cursor-not-allowed disabled:opacity-60",
              "resize-y",
              errors.reminderTemplateUrdu ? "border-danger" : "border-border",
            ].join(" ")}
          />
          {errors.reminderTemplateUrdu && (
            <p role="alert" className="text-sm text-danger">
              {errors.reminderTemplateUrdu}
            </p>
          )}
        </label>

        {/* Default reminder language */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">
            {translate(
              dictionary,
              "settings.khata.defaultReminderLanguageLabel"
            )}
          </span>
          <div
            role="radiogroup"
            className="inline-flex items-center gap-1 self-start rounded-lg border border-border bg-surface p-1"
          >
            {(["en", "ur"] as const).map((lang) => {
              const isActive = form.defaultReminderLanguage === lang;
              const labelKey =
                lang === "en"
                  ? "settings.khata.defaultReminderLanguageEnglish"
                  : "settings.khata.defaultReminderLanguageUrdu";
              return (
                <button
                  key={lang}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => update("defaultReminderLanguage", lang)}
                  disabled={isSubmitting}
                  className={[
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                    isActive
                      ? "bg-primary text-white"
                      : "text-text-muted hover:bg-surface-muted",
                  ].join(" ")}
                >
                  {translate(dictionary, labelKey)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
        >
          {translate(dictionary, "settings.save")}
        </Button>
      </div>
    </form>
  );
}