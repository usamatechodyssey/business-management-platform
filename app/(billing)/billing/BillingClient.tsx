// app/(dashboard)/billing/BillingClient.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { Badge } from "@/app/components/ui/Badge";
import { PaymentSubmitModal } from "@/app/components/billing/PaymentSubmitModal";
import { PaymentHistoryList } from "@/app/components/billing/PaymentHistoryList";
import { formatDate } from "@/lib/format";
import { translate, type Dictionary, type Locale } from "@/lib/i18n";
import type { Business, Payment, PlanTier } from "@/types";

interface BillingClientProps {
  business: Business;
  payments: Payment[];
  plans: PlanTier[];
  platformInfo: {
    displayName: string;
    jazzcash: string | null;
    easypaisa: string | null;
    bank: string | null;
  };
  platformWhatsAppNumber: string;
  locale: Locale;
  dictionary: Dictionary;
}

export function BillingClient({
  business,
  payments,
  plans,
  platformInfo,
  platformWhatsAppNumber,
  locale,
  dictionary,
}: BillingClientProps) {
  const searchParams = useSearchParams();
  const [submitOpen, setSubmitOpen] = useState(false);
  // Plan preselected via URL — set when the user arrives from the
  // comparison page (/billing/plans) with ?plan=SLUG. Cleared when the
  // modal closes so a second open from the top button doesn't re-use it.
  const [preselectedPlan, setPreselectedPlan] = useState<string | null>(null);

  const sub = business.subscription;

  // Purchasable = everything except trial.
  const purchasablePlans = plans.filter((p) => !p.isTrialPlan);

  // If the URL has ?plan=SLUG, open the payment modal with that plan
  // preselected. Runs once per URL change; the effect only fires when
  // the search params or plans change.
  useEffect(() => {
    const slug = searchParams.get("plan");
    if (!slug) return;
    if (!plans.some((p) => p.slug === slug)) return;
    setPreselectedPlan(slug);
    setSubmitOpen(true);
  }, [searchParams, plans]);

  const daysLeft = (() => {
    if (!sub?.expiresAt) return null;
    const ms = new Date(sub.expiresAt).getTime() - Date.now();
    if (ms <= 0) return 0;
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  })();

  // Plan name resolved from the dynamic list. Falls back to the raw slug
  // when the plan was deleted after this subscription was set.
  const planName = (() => {
    if (!sub) return null;
    return plans.find((p) => p.slug === sub.plan)?.name ?? sub.plan;
  })();

  const statusLabelKey = sub
    ? sub.status === "active"
      ? ("billing.subscription.statusActive" as const)
      : sub.status === "trial"
        ? ("billing.subscription.statusTrial" as const)
        : sub.status === "suspended"
          ? ("billing.subscription.statusSuspended" as const)
          : ("billing.subscription.statusExpired" as const)
    : null;

  const statusVariant = sub
    ? sub.status === "active"
      ? "success"
      : sub.status === "trial"
        ? "primary"
        : sub.status === "suspended"
          ? "warning"
          : "danger"
    : "neutral";

  const hasPurchasablePlans = purchasablePlans.length > 0;

  function handleOpenSubmit() {
    setPreselectedPlan(null);
    setSubmitOpen(true);
  }

  function handleCloseSubmit() {
    setSubmitOpen(false);
    setPreselectedPlan(null);
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {translate(dictionary, "billing.title")}
          </h1>
          <p className="text-sm text-text-muted">
            {translate(dictionary, "billing.subtitle")}
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={handleOpenSubmit}
          disabled={!hasPurchasablePlans}
          leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
        >
          {translate(dictionary, "billing.subscription.renew")}
        </Button>
      </div>

      {/* Plans comparison link */}
      {hasPurchasablePlans && (
        <Link
          href="/billing/plans"
          className="text-sm font-medium text-primary hover:underline"
        >
          {translate(dictionary, "billing.subscription.comparePlans")}
        </Link>
      )}

      {/* Subscription card */}
      <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">
            {translate(dictionary, "billing.subscription.heading")}
          </h2>
          {sub && (
            <Badge variant={statusVariant}>
              {statusLabelKey ? translate(dictionary, statusLabelKey) : ""}
            </Badge>
          )}
        </div>

        {sub ? (
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-text-muted">
                {translate(dictionary, "billing.subscription.planLabel")}
              </dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {planName}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">
                {translate(dictionary, "billing.subscription.expiresLabel")}
              </dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {formatDate(sub.expiresAt, locale)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">&nbsp;</dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {daysLeft === null
                  ? ""
                  : daysLeft <= 0
                    ? translate(dictionary, "billing.subscription.expired")
                    : daysLeft === 1
                      ? translate(dictionary, "billing.subscription.dayLeft")
                      : translate(dictionary, "billing.subscription.daysLeft", {
                          count: daysLeft,
                        })}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-text-muted">
            {translate(dictionary, "billing.subscription.notSet")}
          </p>
        )}
      </div>

      {/* Payment history */}
      <PaymentHistoryList
        payments={payments}
        plans={plans}
        businessName={business.name}
        platformWhatsAppNumber={platformWhatsAppNumber}
        locale={locale}
        dictionary={dictionary}
      />

      {/* Submit modal */}
      <PaymentSubmitModal
        isOpen={submitOpen}
        onClose={handleCloseSubmit}
        plans={purchasablePlans}
        initialPlanSlug={preselectedPlan}
        platformInfo={platformInfo}
        dictionary={dictionary}
      />
    </div>
  );
}