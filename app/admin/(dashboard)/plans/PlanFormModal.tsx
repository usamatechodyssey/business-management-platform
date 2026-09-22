// app/admin/(dashboard)/plans/PlanFormModal.tsx
"use client";

import { useEffect, useState, type SubmitEvent } from "react";
import { Modal } from "@/app/components/ui/Modal";
import { Input } from "@/app/components/ui/Input";
import { Button } from "@/app/components/ui/Button";
import { useToast } from "@/app/components/ui/Toast";
import { translate, type Dictionary } from "@/lib/i18n";
import { UNLIMITED } from "@/types";
import type { PlanLimits, PlanTier } from "@/types";

interface PlanFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: PlanTier | null;
  existingPlans: PlanTier[];
  dictionary: Dictionary;
  onSuccess: () => void;
}

interface FormState {
  slug: string;
  name: string;
  priceMonthly: string;
  description: string;
  featuresText: string;
  users: string;
  products: string;
  customers: string;
  suppliers: string;
  salesPerMonth: string;
  displayOrder: string;
  active: boolean;
}

interface FieldErrors {
  slug?: string;
  name?: string;
  priceMonthly?: string;
  limits?: string;
}

const EMPTY_FORM: FormState = {
  slug: "",
  name: "",
  priceMonthly: "",
  description: "",
  featuresText: "",
  users: "10",
  products: "100",
  customers: "100",
  suppliers: "10",
  salesPerMonth: "100",
  displayOrder: "10",
  active: true,
};

function planToForm(p: PlanTier): FormState {
  return {
    slug: p.slug,
    name: p.name,
    priceMonthly: String(p.priceMonthly),
    description: p.description ?? "",
    featuresText: p.features.join("\n"),
    users: String(p.limits.users),
    products: String(p.limits.products),
    customers: String(p.limits.customers),
    suppliers: String(p.limits.suppliers),
    salesPerMonth: String(p.limits.salesPerMonth),
    displayOrder: String(p.displayOrder),
    active: p.active,
  };
}

// Parses a form field as either -1 (unlimited) or a non-negative int.
// Returns NaN for invalid input so callers can flag it.
function parseLimit(value: string): number {
  const trimmed = value.trim();
  if (trimmed === "-1") return UNLIMITED;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return NaN;
  return n;
}

export function PlanFormModal({
  isOpen,
  onClose,
  plan,
  existingPlans,
  dictionary,
  onSuccess,
}: PlanFormModalProps) {
  const { push } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEdit = plan !== null;

  useEffect(() => {
    if (!isOpen) return;
    setForm(plan ? planToForm(plan) : EMPTY_FORM);
    setErrors({});
    setFormError(null);
  }, [isOpen, plan]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};

    const slug = form.slug.trim();
    if (!isEdit) {
      if (slug.length < 2 || slug.length > 30) {
        next.slug = translate(dictionary, "admin.plans.form.errors.slugInvalid");
      } else if (!/^[a-z0-9-]+$/.test(slug)) {
        next.slug = translate(dictionary, "admin.plans.form.errors.slugCharset");
            } else if (existingPlans.some((p) => p.slug === slug)) {
        next.slug = translate(dictionary, "admin.plans.form.errors.slugTaken");
      }
    }

    const name = form.name.trim();
    if (name.length < 2 || name.length > 50) {
      next.name = translate(dictionary, "admin.plans.form.errors.nameInvalid");
    }

    const price = Number(form.priceMonthly);
    if (
      form.priceMonthly.trim() === "" ||
      !Number.isFinite(price) ||
      !Number.isInteger(price) ||
      price < 0
    ) {
      next.priceMonthly = translate(
        dictionary,
        "admin.plans.form.errors.priceInvalid"
      );
    }

    // Every limit must parse (either -1 or a valid non-negative int).
    const limits = [
      form.users,
      form.products,
      form.customers,
      form.suppliers,
      form.salesPerMonth,
    ];
    if (limits.some((v) => Number.isNaN(parseLimit(v)))) {
      next.limits = translate(dictionary, "admin.plans.form.errors.limitsInvalid");
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

    const features = form.featuresText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const limits: PlanLimits = {
      users: parseLimit(form.users),
      products: parseLimit(form.products),
      customers: parseLimit(form.customers),
      suppliers: parseLimit(form.suppliers),
      salesPerMonth: parseLimit(form.salesPerMonth),
    };

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      priceMonthly: Number(form.priceMonthly),
      description: form.description.trim(),
      features,
      limits,
      displayOrder: Number(form.displayOrder) || 0,
      active: form.active,
    };

    // Slug is immutable on the server for the trial plan; sending it
    // anyway for non-trial plans is fine.
    if (!isEdit) payload.slug = form.slug.trim();
    else if (!plan.isTrialPlan) payload.slug = form.slug.trim();

    try {
      const url = isEdit ? `/api/admin/plans/${plan.id}` : "/api/admin/plans";
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
            isEdit ? "admin.plans.updated" : "admin.plans.created"
          ),
          variant: "success",
        });
        onSuccess();
        return;
      }

      let body: { error?: { code?: string } } | null = null;
      try {
        body = (await response.json()) as { error?: { code?: string } };
      } catch {
        body = null;
      }

      const code = body?.error?.code;
      if (code === "PLAN_SLUG_TAKEN") {
        setErrors({
          slug: translate(dictionary, "admin.plans.form.errors.slugTaken"),
        });
        return;
      }
      if (code === "TRIAL_SLUG_LOCKED") {
        setFormError(
          translate(dictionary, "admin.plans.form.errors.trialSlugLocked")
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
      title={translate(
        dictionary,
        isEdit ? "admin.plans.form.editTitle" : "admin.plans.form.createTitle"
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
            form="plan-form"
            variant="primary"
            isLoading={isSubmitting}
          >
            {translate(dictionary, "common.save")}
          </Button>
        </>
      }
    >
      <form
        id="plan-form"
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
          label={translate(dictionary, "admin.plans.form.slugLabel")}
          name="slug"
          type="text"
          value={form.slug}
          onChange={(event) =>
            update("slug", event.target.value.toLowerCase())
          }
          error={errors.slug}
          helperText={
            plan?.isTrialPlan
              ? translate(dictionary, "admin.plans.form.slugLockedHelper")
              : translate(dictionary, "admin.plans.form.slugHelper")
          }
          disabled={isSubmitting || plan?.isTrialPlan}
          required
        />

        <Input
          label={translate(dictionary, "admin.plans.form.nameLabel")}
          name="name"
          type="text"
          value={form.name}
          onChange={(event) => update("name", event.target.value)}
          error={errors.name}
          disabled={isSubmitting}
          required
        />

        <Input
          label={translate(dictionary, "admin.plans.form.priceLabel")}
          name="priceMonthly"
          type="number"
          inputMode="numeric"
          min={0}
          value={form.priceMonthly}
          onChange={(event) => update("priceMonthly", event.target.value)}
          error={errors.priceMonthly}
          helperText={translate(
            dictionary,
            "admin.plans.form.priceHelper"
          )}
          disabled={isSubmitting}
          required
        />

        <Input
          label={translate(dictionary, "admin.plans.form.descriptionLabel")}
          name="description"
          type="text"
          value={form.description}
          onChange={(event) => update("description", event.target.value)}
          helperText={translate(dictionary, "common.optional")}
          disabled={isSubmitting}
        />

        {/* Features as a multi-line textarea — one per line. */}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">
            {translate(dictionary, "admin.plans.form.featuresLabel")}
          </span>
          <textarea
            value={form.featuresText}
            onChange={(event) => update("featuresText", event.target.value)}
            disabled={isSubmitting}
            rows={5}
            className={[
              "w-full rounded-lg border bg-surface px-3 py-2 text-sm text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              "disabled:cursor-not-allowed disabled:opacity-60",
              "resize-y",
              "border-border",
            ].join(" ")}
          />
          <p className="text-xs text-text-muted">
            {translate(dictionary, "admin.plans.form.featuresHelper")}
          </p>
        </label>

        {/* Limits section */}
        <fieldset className="rounded-lg border border-border bg-surface-muted p-3">
          <legend className="px-1 text-sm font-medium text-foreground">
            {translate(dictionary, "admin.plans.form.limitsLabel")}
          </legend>
          <p className="mb-2 text-xs text-text-muted">
            {translate(dictionary, "admin.plans.form.limitsHelper")}
          </p>
          {errors.limits && (
            <p className="mb-2 text-sm text-danger" role="alert">
              {errors.limits}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Input
              label={translate(dictionary, "admin.plans.form.limitUsers")}
              name="users"
              type="number"
              inputMode="numeric"
              value={form.users}
              onChange={(event) => update("users", event.target.value)}
              disabled={isSubmitting}
            />
            <Input
              label={translate(dictionary, "admin.plans.form.limitProducts")}
              name="products"
              type="number"
              inputMode="numeric"
              value={form.products}
              onChange={(event) => update("products", event.target.value)}
              disabled={isSubmitting}
            />
            <Input
              label={translate(dictionary, "admin.plans.form.limitCustomers")}
              name="customers"
              type="number"
              inputMode="numeric"
              value={form.customers}
              onChange={(event) => update("customers", event.target.value)}
              disabled={isSubmitting}
            />
            <Input
              label={translate(dictionary, "admin.plans.form.limitSuppliers")}
              name="suppliers"
              type="number"
              inputMode="numeric"
              value={form.suppliers}
              onChange={(event) => update("suppliers", event.target.value)}
              disabled={isSubmitting}
            />
            <Input
              label={translate(dictionary, "admin.plans.form.limitSales")}
              name="salesPerMonth"
              type="number"
              inputMode="numeric"
              value={form.salesPerMonth}
              onChange={(event) => update("salesPerMonth", event.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </fieldset>

        <Input
          label={translate(dictionary, "admin.plans.form.orderLabel")}
          name="displayOrder"
          type="number"
          inputMode="numeric"
          min={0}
          value={form.displayOrder}
          onChange={(event) => update("displayOrder", event.target.value)}
          helperText={translate(dictionary, "admin.plans.form.orderHelper")}
          disabled={isSubmitting}
        />

        <label className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(event) => update("active", event.target.checked)}
            disabled={isSubmitting}
            className="mt-0.5 h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              {translate(dictionary, "admin.plans.form.activeLabel")}
            </p>
            <p className="text-xs text-text-muted">
              {translate(dictionary, "admin.plans.form.activeHelper")}
            </p>
          </div>
        </label>
      </form>
    </Modal>
  );
}