// app/admin/(dashboard)/settings/AdminSettingsClient.tsx
"use client";

import { useEffect, useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/app/components/ui/Input";
import { Button } from "@/app/components/ui/Button";
import { useToast } from "@/app/components/ui/Toast";
import { translate, type Dictionary } from "@/lib/i18n";
import type { PlatformSettings } from "@/types";

interface AdminSettingsClientProps {
  settings: PlatformSettings;
  dictionary: Dictionary;
}

interface FormState {
  trialEnabled: boolean;
  trialDays: string;
  trialWarningDays: string;
  supportWhatsApp: string;
  supportEmail: string;
  blockedTitleOverride: string;
  blockedDescriptionOverride: string;
  bulkReminderTemplate: string;
}

interface FieldErrors {
  trialDays?: string;
  trialWarningDays?: string;
  supportEmail?: string;
  bulkReminderTemplate?: string;
}

function settingsToForm(s: PlatformSettings): FormState {
  return {
    trialEnabled: s.trialEnabled,
    trialDays: String(s.trialDays),
    trialWarningDays: String(s.trialWarningDays),
    supportWhatsApp: s.supportWhatsApp,
    supportEmail: s.supportEmail,
    blockedTitleOverride: s.blockedTitleOverride ?? "",
    blockedDescriptionOverride: s.blockedDescriptionOverride ?? "",
    bulkReminderTemplate: s.bulkReminderTemplate,
  };
}

export function AdminSettingsClient({
  settings,
  dictionary,
}: AdminSettingsClientProps) {
  const router = useRouter();
  const { push } = useToast();

  const [form, setForm] = useState<FormState>(settingsToForm(settings));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setForm(settingsToForm(settings));
    setErrors({});
    setFormError(null);
  }, [settings]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};

    const trialDays = Number(form.trialDays);
    if (
      form.trialDays.trim() === "" ||
      !Number.isInteger(trialDays) ||
      trialDays < 1 ||
      trialDays > 90
    ) {
      next.trialDays = translate(
        dictionary,
        "admin.settings.errors.trialDaysInvalid"
      );
    }

    const warnDays = Number(form.trialWarningDays);
    if (
      form.trialWarningDays.trim() === "" ||
      !Number.isInteger(warnDays) ||
      warnDays < 0 ||
      warnDays > 30
    ) {
      next.trialWarningDays = translate(
        dictionary,
        "admin.settings.errors.trialWarningDaysInvalid"
      );
    }

    if (form.supportEmail.trim() !== "") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.supportEmail.trim())) {
        next.supportEmail = translate(
          dictionary,
          "admin.settings.errors.supportEmailInvalid"
        );
      }
    }

    if (form.bulkReminderTemplate.trim().length === 0) {
      next.bulkReminderTemplate = translate(
        dictionary,
        "admin.settings.errors.bulkTemplateRequired"
      );
    } else if (form.bulkReminderTemplate.length > 500) {
      next.bulkReminderTemplate = translate(
        dictionary,
        "admin.settings.errors.bulkTemplateTooLong"
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
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trialEnabled: form.trialEnabled,
          trialDays: Number(form.trialDays),
          trialWarningDays: Number(form.trialWarningDays),
          supportWhatsApp: form.supportWhatsApp.trim(),
          supportEmail: form.supportEmail.trim(),
          blockedTitleOverride:
            form.blockedTitleOverride.trim() === ""
              ? null
              : form.blockedTitleOverride.trim(),
          blockedDescriptionOverride:
            form.blockedDescriptionOverride.trim() === ""
              ? null
              : form.blockedDescriptionOverride.trim(),
          bulkReminderTemplate: form.bulkReminderTemplate.trim(),
        }),
      });

      if (response.ok) {
        push({
          message: translate(dictionary, "admin.settings.saved"),
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          {translate(dictionary, "admin.settings.title")}
        </h1>
        <p className="text-sm text-text-muted">
          {translate(dictionary, "admin.settings.subtitle")}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col gap-6"
      >
        {formError && (
          <div
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            {formError}
          </div>
        )}

        {/* Trial section */}
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <h2 className="text-base font-semibold text-foreground">
            {translate(dictionary, "admin.settings.trialHeading")}
          </h2>
          <p className="text-xs text-text-muted">
            {translate(dictionary, "admin.settings.trialDescription")}
          </p>

          <label className="flex items-start gap-3 rounded-lg border border-border bg-surface-muted p-3">
            <input
              type="checkbox"
              checked={form.trialEnabled}
              onChange={(event) =>
                update("trialEnabled", event.target.checked)
              }
              disabled={isSubmitting}
              className="mt-0.5 h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {translate(dictionary, "admin.settings.trialEnabledLabel")}
              </p>
              <p className="text-xs text-text-muted">
                {translate(dictionary, "admin.settings.trialEnabledHelper")}
              </p>
            </div>
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label={translate(
                dictionary,
                "admin.settings.trialDaysLabel"
              )}
              name="trialDays"
              type="number"
              inputMode="numeric"
              min={1}
              max={90}
              value={form.trialDays}
              onChange={(event) => update("trialDays", event.target.value)}
              error={errors.trialDays}
              helperText={translate(
                dictionary,
                "admin.settings.trialDaysHelper"
              )}
              disabled={isSubmitting || !form.trialEnabled}
            />
            <Input
              label={translate(
                dictionary,
                "admin.settings.trialWarningDaysLabel"
              )}
              name="trialWarningDays"
              type="number"
              inputMode="numeric"
              min={0}
              max={30}
              value={form.trialWarningDays}
              onChange={(event) =>
                update("trialWarningDays", event.target.value)
              }
              error={errors.trialWarningDays}
              helperText={translate(
                dictionary,
                "admin.settings.trialWarningDaysHelper"
              )}
              disabled={isSubmitting || !form.trialEnabled}
            />
          </div>
        </section>

        {/* Support section */}
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <h2 className="text-base font-semibold text-foreground">
            {translate(dictionary, "admin.settings.supportHeading")}
          </h2>
          <p className="text-xs text-text-muted">
            {translate(dictionary, "admin.settings.supportDescription")}
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label={translate(
                dictionary,
                "admin.settings.supportWhatsAppLabel"
              )}
              name="supportWhatsApp"
              type="tel"
              inputMode="tel"
              value={form.supportWhatsApp}
              onChange={(event) =>
                update("supportWhatsApp", event.target.value)
              }
              helperText={translate(
                dictionary,
                "admin.settings.supportWhatsAppHelper"
              )}
              disabled={isSubmitting}
            />
            <Input
              label={translate(
                dictionary,
                "admin.settings.supportEmailLabel"
              )}
              name="supportEmail"
              type="email"
              inputMode="email"
              value={form.supportEmail}
              onChange={(event) =>
                update("supportEmail", event.target.value)
              }
              error={errors.supportEmail}
              helperText={translate(
                dictionary,
                "admin.settings.supportEmailHelper"
              )}
              disabled={isSubmitting}
            />
          </div>
        </section>

        {/* Blocked screen overrides */}
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <h2 className="text-base font-semibold text-foreground">
            {translate(dictionary, "admin.settings.blockedHeading")}
          </h2>
          <p className="text-xs text-text-muted">
            {translate(dictionary, "admin.settings.blockedDescription")}
          </p>

          <Input
            label={translate(
              dictionary,
              "admin.settings.blockedTitleLabel"
            )}
            name="blockedTitleOverride"
            type="text"
            value={form.blockedTitleOverride}
            onChange={(event) =>
              update("blockedTitleOverride", event.target.value)
            }
            helperText={translate(
              dictionary,
              "admin.settings.blockedOverrideHelper"
            )}
            disabled={isSubmitting}
          />

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              {translate(
                dictionary,
                "admin.settings.blockedDescLabel"
              )}
            </span>
            <textarea
              value={form.blockedDescriptionOverride}
              onChange={(event) =>
                update("blockedDescriptionOverride", event.target.value)
              }
              disabled={isSubmitting}
              rows={3}
              className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            />
            <p className="text-xs text-text-muted">
              {translate(
                dictionary,
                "admin.settings.blockedOverrideHelper"
              )}
            </p>
          </label>
        </section>

        {/* Bulk WhatsApp template */}
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <h2 className="text-base font-semibold text-foreground">
            {translate(dictionary, "admin.settings.bulkHeading")}
          </h2>
          <p className="text-xs text-text-muted">
            {translate(dictionary, "admin.settings.bulkDescription")}
          </p>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              {translate(
                dictionary,
                "admin.settings.bulkTemplateLabel"
              )}
            </span>
            <textarea
              value={form.bulkReminderTemplate}
              onChange={(event) =>
                update("bulkReminderTemplate", event.target.value)
              }
              disabled={isSubmitting}
              rows={4}
              className={[
                "w-full resize-y rounded-lg border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60",
                errors.bulkReminderTemplate
                  ? "border-danger"
                  : "border-border",
              ].join(" ")}
            />
            <p className="text-xs text-text-muted">
              {translate(
                dictionary,
                "admin.settings.bulkPlaceholdersHint"
              )}
            </p>
            {errors.bulkReminderTemplate && (
              <p className="text-sm text-danger" role="alert">
                {errors.bulkReminderTemplate}
              </p>
            )}
          </label>
        </section>

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
    </div>
  );
}