// app/(dashboard)/billing/plans/PlansComparison.tsx
"use client";

import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { formatCurrency } from "@/lib/format";
import { translate, type Dictionary, type Locale } from "@/lib/i18n";
import { UNLIMITED } from "@/types";
import type { PlanLimits, PlanTier } from "@/types";

interface PlansComparisonProps {
  plans: PlanTier[];
  locale: Locale;
  dictionary: Dictionary;
}

interface LimitRow {
  key: keyof PlanLimits;
  labelKey:
    | "billing.plans.limits.users"
    | "billing.plans.limits.products"
    | "billing.plans.limits.customers"
    | "billing.plans.limits.suppliers"
    | "billing.plans.limits.salesPerMonth";
}

const LIMIT_ROWS: LimitRow[] = [
  { key: "users", labelKey: "billing.plans.limits.users" },
  { key: "products", labelKey: "billing.plans.limits.products" },
  { key: "customers", labelKey: "billing.plans.limits.customers" },
  { key: "suppliers", labelKey: "billing.plans.limits.suppliers" },
  { key: "salesPerMonth", labelKey: "billing.plans.limits.salesPerMonth" },
];

function formatLimit(value: number, dictionary: Dictionary): string {
  return value === UNLIMITED
    ? translate(dictionary, "billing.plans.unlimited")
    : String(value);
}

export function PlansComparison({
  plans,
  dictionary,
}: PlansComparisonProps) {
  // locale prop is used by formatDate in payment history, not here. We
  // keep it in the signature so the page can pass it in without another
  // refactor if we add date formatting later.
  void 0;

  if (plans.length === 0) {
    return (
      <div className="p-4 sm:p-6">
        <Link
          href="/billing"
          className="inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {translate(dictionary, "billing.title")}
        </Link>
        <div className="mt-6">
          <EmptyState
            title={translate(dictionary, "billing.plans.empty.title")}
            description={translate(
              dictionary,
              "billing.plans.empty.description"
            )}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div>
        <Link
          href="/billing"
          className="inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {translate(dictionary, "billing.title")}
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-foreground">
          {translate(dictionary, "billing.plans.title")}
        </h1>
        <p className="text-sm text-text-muted">
          {translate(dictionary, "billing.plans.subtitle")}
        </p>
      </div>

      {/* Plan cards — stacked on mobile, grid on desktop */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={[
              "flex flex-col gap-4 rounded-xl border-2 bg-surface p-5 shadow-sm transition-all",
              plan.displayOrder === 2
                ? "border-primary shadow-md"
                : "border-border",
            ].join(" ")}
          >
            {/* Recommended badge for the middle-tier by display order */}
            {plan.displayOrder === 2 && (
              <div className="self-start rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-white">
                {translate(dictionary, "billing.plans.popular")}
              </div>
            )}

            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {plan.name}
              </h2>
              {plan.description && (
                <p className="mt-1 text-sm text-text-muted">
                  {plan.description}
                </p>
              )}
            </div>

            <div>
              <p className="text-3xl font-bold text-foreground">
                {formatCurrency(plan.priceMonthly)}
                <span className="text-sm font-normal text-text-muted">
                  {" "}
                  {translate(dictionary, "billing.plans.perMonth")}
                </span>
              </p>
            </div>

            {/* Features */}
            <ul className="flex flex-col gap-2">
              {plan.features.map((feature, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-sm text-foreground"
                >
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-success"
                    aria-hidden="true"
                  />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {/* Limits table */}
            <div className="rounded-lg bg-surface-muted p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                {translate(dictionary, "billing.plans.limitsHeading")}
              </p>
              <dl className="flex flex-col gap-1.5 text-xs">
                {LIMIT_ROWS.map((row) => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between gap-2"
                  >
                    <dt className="text-text-muted">
                      {translate(dictionary, row.labelKey)}
                    </dt>
                    <dd className="font-medium tabular-nums text-foreground">
                      {formatLimit(plan.limits[row.key], dictionary)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <Button
              type="button"
              variant={plan.displayOrder === 2 ? "primary" : "secondary"}
              fullWidth
              onClick={() => {
                window.location.href = `/billing?plan=${encodeURIComponent(plan.slug)}`;
              }}
            >
              {translate(dictionary, "billing.plans.choose")}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}