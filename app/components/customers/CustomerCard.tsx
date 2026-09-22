// app/components/customers/CustomerCard.tsx
"use client";

import { BookOpen, Edit3, MessageCircle, Trash2, Wallet } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { translate, type Dictionary, type Locale } from "@/lib/i18n";
import type { Customer, KhataSettings } from "@/types";

interface CustomerCardProps {
  customer: Customer;
  khataSettings: KhataSettings;
  locale: Locale;
  dictionary: Dictionary;
  onViewLedger: (customer: Customer) => void;
  onRecordPayment: (customer: Customer) => void;
  onRemind: (customer: Customer) => void;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
}

function ActionButton({
  label,
  tooltip,
  onClick,
  icon,
  tone = "neutral",
  disabled = false,
}: {
  label: string;
  // Optional longer description shown as the native browser tooltip.
  // Falls back to `label` when omitted. `label` always stays the
  // aria-label so screen readers get the short form.
  tooltip?: string;
  onClick: () => void;
  icon: React.ReactNode;
  tone?: "neutral" | "primary" | "danger";
  disabled?: boolean;
}) {
  const toneClasses =
    tone === "danger"
      ? "hover:bg-danger/10 hover:text-danger"
      : tone === "primary"
        ? "hover:bg-primary/10 hover:text-primary"
        : "hover:bg-surface-muted hover:text-foreground";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={tooltip ?? label}
      className={[
        "rounded-md p-2 text-text-muted transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text-muted",
        toneClasses,
      ].join(" ")}
    >
      {icon}
    </button>
  );
}

export function CustomerCard({
  customer,
  khataSettings,
  locale,
  dictionary,
  onViewLedger,
  onRecordPayment,
  onRemind,
  onEdit,
  onDelete,
}: CustomerCardProps){
  const hasDue = customer.totalDue > 0;
  const isOverLimit =
    khataSettings.creditLimitEnabled &&
    typeof customer.creditLimit === "number" &&
    customer.creditLimit > 0 &&
    customer.totalDue > customer.creditLimit;

  // Overdue check: dueDate passed and there's still a balance.
  const isOverdue =
    khataSettings.dueDateTrackingEnabled &&
    !!customer.dueDate &&
    hasDue &&
    new Date(customer.dueDate).getTime() < Date.now() - 24 * 60 * 60 * 1000;

  const khataTooltip = translate(dictionary, "customers.khataTooltip");

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-foreground">
              {customer.name}
            </h3>
            {customer.tag && (
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-muted">
                {customer.tag}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-text-muted">{customer.phone}</p>
          {khataSettings.guarantorEnabled && customer.guarantorName && (
            <p className="text-xs text-text-muted">
              {translate(dictionary, "customers.card.guarantorPrefix", {
                name: customer.guarantorName,
              })}
            </p>
          )}
          {khataSettings.dueDateTrackingEnabled && customer.dueDate && (
            <p
              className={[
                "text-xs",
                isOverdue ? "font-medium text-danger" : "text-text-muted",
              ].join(" ")}
            >
              {translate(dictionary, "customers.card.duePrefix", {
                date: formatDate(customer.dueDate, locale),
              })}
            </p>
          )}
        </div>

        <div
          className={[
            "shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold",
            isOverLimit
              ? "bg-danger/10 text-danger"
              : hasDue
                ? "bg-warning/10 text-warning"
                : "bg-success/10 text-success",
          ].join(" ")}
        >
          {hasDue
            ? translate(dictionary, "customers.card.owes", {
                amount: formatCurrency(customer.totalDue),
              })
            : translate(dictionary, "customers.card.clear")}
        </div>
      </div>

      {customer.address && (
        <p className="truncate text-xs text-text-muted">{customer.address}</p>
      )}

      {isOverLimit && (
        <p className="rounded-lg bg-danger/10 px-2 py-1 text-xs font-medium text-danger">
          {translate(dictionary, "customers.card.overLimit")}
        </p>
      )}

      <div className="flex items-center justify-end gap-1 border-t border-border pt-2">
        <ActionButton
          label={translate(dictionary, "customers.card.viewLedger")}
          tooltip={khataTooltip}
          onClick={() => onViewLedger(customer)}
          icon={<BookOpen className="h-4 w-4" aria-hidden="true" />}
        />
        <ActionButton
          label={translate(dictionary, "customers.card.recordPayment")}
          onClick={() => onRecordPayment(customer)}
          icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
          tone="primary"
          disabled={!hasDue}
        />
          <ActionButton
          label={translate(dictionary, "customers.card.remind")}
          onClick={() => onRemind(customer)}
          icon={<MessageCircle className="h-4 w-4" aria-hidden="true" />}
          disabled={!hasDue}
        />
        <ActionButton
          label={translate(dictionary, "customers.card.edit")}
          onClick={() => onEdit(customer)}
          icon={<Edit3 className="h-4 w-4" aria-hidden="true" />}
        />
        <ActionButton
          label={translate(dictionary, "customers.card.delete")}
          onClick={() => onDelete(customer)}
          icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
          tone="danger"
        />
      </div>
    </div>
  );
}