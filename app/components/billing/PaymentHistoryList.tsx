// app/components/billing/PaymentHistoryList.tsx
"use client";

import { MessageCircle } from "lucide-react";
import { Badge } from "@/app/components/ui/Badge";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/format";
import { translate, type Dictionary, type Locale } from "@/lib/i18n";
import { normalizePhoneForWhatsApp } from "@/lib/whatsapp";
import type { Payment, PaymentStatus, PlanTier } from "@/types";

interface PaymentHistoryListProps {
  payments: Payment[];
  plans: PlanTier[];
  businessName: string;
  platformWhatsAppNumber: string;
  locale: Locale;
  dictionary: Dictionary;
}

function statusVariant(
  status: PaymentStatus
): "primary" | "success" | "warning" | "danger" {
  if (status === "verified") return "success";
  if (status === "rejected") return "danger";
  return "warning";
}

function statusLabelKey(status: PaymentStatus) {
  if (status === "verified") return "billing.history.statusVerified" as const;
  if (status === "rejected") return "billing.history.statusRejected" as const;
  return "billing.history.statusPending" as const;
}

// Plans can be deleted; historical payments should still render, so we
// fall back to the slug when the plan no longer exists.
function planName(slug: string, plans: PlanTier[]): string {
  return plans.find((p) => p.slug === slug)?.name ?? slug;
}

function buildWhatsAppLink(
  platformNumber: string,
  template: string,
  values: Record<string, string>
): string | null {
  const phone = normalizePhoneForWhatsApp(platformNumber);
  if (!phone) return null;
  const message = template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return values[key] ?? "";
  });
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function PaymentHistoryList({
  payments,
  plans,
  businessName,
  platformWhatsAppNumber,
  locale,
  dictionary,
}: PaymentHistoryListProps) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-foreground">
        {translate(dictionary, "billing.history.title")}
      </h2>

      {payments.length === 0 ? (
        <EmptyState
          title={translate(dictionary, "billing.history.emptyTitle")}
          description={translate(
            dictionary,
            "billing.history.emptyDescription"
          )}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {payments.map((payment) => {
            const planLabel = planName(payment.plan, plans);
            const amountLabel = formatCurrency(payment.amount);

            const whatsappLink =
              payment.status === "pending"
                ? buildWhatsAppLink(
                    platformWhatsAppNumber,
                    translate(
                      dictionary,
                      "billing.history.whatsappMessage"
                    ),
                    {
                      reference: payment.reference,
                      businessName,
                      plan: planLabel,
                      months: String(payment.months),
                      amount: String(payment.amount),
                    }
                  )
                : null;

            return (
              <li
                key={payment.id}
                className="rounded-xl border border-border bg-surface p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-foreground">
                      {payment.reference}
                    </span>
                    <Badge variant={statusVariant(payment.status)}>
                      {translate(dictionary, statusLabelKey(payment.status))}
                    </Badge>
                  </div>
                  <span className="text-xs text-text-muted">
                    {formatDate(payment.paidAt, locale)}
                  </span>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-text-muted">
                      {translate(dictionary, "billing.history.planLabel")}
                    </dt>
                    <dd className="mt-0.5 font-medium text-foreground">
                      {planLabel} · {payment.months}m
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-muted">
                      {translate(dictionary, "billing.history.amountLabel")}
                    </dt>
                    <dd className="mt-0.5 font-medium text-foreground">
                      {amountLabel}
                    </dd>
                  </div>
                  {payment.transactionId && (
                    <div className="col-span-2">
                      <dt className="text-xs text-text-muted">
                        {translate(
                          dictionary,
                          "billing.history.transactionIdLabel"
                        )}
                      </dt>
                      <dd className="mt-0.5 font-mono text-xs text-foreground">
                        {payment.transactionId}
                      </dd>
                    </div>
                  )}
                </dl>

                {payment.status === "rejected" && payment.rejectionReason && (
                  <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
                    {translate(
                      dictionary,
                      "billing.history.rejectionReasonLabel"
                    )}
                    : {payment.rejectionReason}
                  </p>
                )}

                {whatsappLink && (
                  <div className="mt-3 flex justify-end border-t border-border pt-3">
                    <a
                      href={whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <MessageCircle
                        className="h-4 w-4"
                        aria-hidden="true"
                      />
                      {translate(
                        dictionary,
                        "billing.history.openWhatsApp"
                      )}
                    </a>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}