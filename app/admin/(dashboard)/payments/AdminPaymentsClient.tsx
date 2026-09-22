// app/admin/(dashboard)/payments/AdminPaymentsClient.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Table, type TableColumn } from "@/app/components/ui/Table";
import { Badge } from "@/app/components/ui/Badge";
import { Pagination } from "@/app/components/ui/Pagination";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { PaymentDetailModal } from "./PaymentDetailModal";
import { formatCurrency, formatDate } from "@/lib/format";
import { translate, type Dictionary, type Locale } from "@/lib/i18n";
import type { Payment, PaymentStatus } from "@/types";

interface AdminPaymentsClientProps {
  payments: Payment[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  activeStatus: PaymentStatus | "all";
  locale: Locale;
  dictionary: Dictionary;
}

const TABS: {
  key: PaymentStatus | "all";
  labelKey:
    | "admin.payments.tabs.pending"
    | "admin.payments.tabs.verified"
    | "admin.payments.tabs.rejected"
    | "admin.payments.tabs.all";
}[] = [
  { key: "pending", labelKey: "admin.payments.tabs.pending" },
  { key: "verified", labelKey: "admin.payments.tabs.verified" },
  { key: "rejected", labelKey: "admin.payments.tabs.rejected" },
  { key: "all", labelKey: "admin.payments.tabs.all" },
];

function statusVariant(
  status: PaymentStatus
): "primary" | "success" | "warning" | "danger" {
  if (status === "verified") return "success";
  if (status === "rejected") return "danger";
  return "warning";
}

function statusLabelKey(status: PaymentStatus) {
  if (status === "verified") return "admin.payments.status.verified" as const;
  if (status === "rejected") return "admin.payments.status.rejected" as const;
  return "admin.payments.status.pending" as const;
}

function methodLabelKey(method: Payment["method"]) {
  if (method === "jazzcash") return "admin.payments.methods.jazzcash" as const;
  if (method === "easypaisa") return "admin.payments.methods.easypaisa" as const;
  if (method === "bank") return "admin.payments.methods.bank" as const;
  return "admin.payments.methods.other" as const;
}

export function AdminPaymentsClient({
  payments,
  pagination,
  activeStatus,
  locale,
  dictionary,
}: AdminPaymentsClientProps) {
  const [detailTarget, setDetailTarget] = useState<Payment | null>(null);

  const columns: TableColumn<Payment>[] = [
    {
      key: "reference",
      header: translate(dictionary, "admin.payments.columns.reference"),
      render: (p) => (
        <button
          type="button"
          onClick={() => setDetailTarget(p)}
          className="font-mono text-sm font-semibold text-primary hover:underline"
        >
          {p.reference}
        </button>
      ),
    },
    {
      key: "businessName",
      header: translate(dictionary, "admin.payments.columns.business"),
      render: (p) => (
        <Link
          href={`/admin/tenants/${p.businessId}`}
          className="font-medium text-foreground hover:text-primary"
        >
          {p.businessName}
        </Link>
      ),
    },
    {
      key: "plan",
      header: translate(dictionary, "admin.payments.columns.plan"),
      render: (p) => `${p.plan} · ${p.months}m`,
    },
    {
      key: "amount",
      header: translate(dictionary, "admin.payments.columns.amount"),
      align: "end",
      render: (p) => (
        <span className="tabular-nums">{formatCurrency(p.amount)}</span>
      ),
    },
    {
      key: "method",
      header: translate(dictionary, "admin.payments.columns.method"),
      render: (p) => translate(dictionary, methodLabelKey(p.method)),
    },
    {
      key: "paidAt",
      header: translate(dictionary, "admin.payments.columns.paidOn"),
      render: (p) => formatDate(p.paidAt, locale),
    },
    {
      key: "createdAt",
      header: translate(dictionary, "admin.payments.columns.submitted"),
      render: (p) => formatDate(p.createdAt, locale),
    },
    {
      key: "status",
      header: translate(dictionary, "admin.payments.columns.status"),
      render: (p) => (
        <Badge variant={statusVariant(p.status)}>
          {translate(dictionary, statusLabelKey(p.status))}
        </Badge>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          {translate(dictionary, "admin.payments.title")}
        </h1>
        <p className="text-sm text-text-muted">
          {translate(dictionary, "admin.payments.subtitle")}
        </p>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((tab) => {
          const isActive = activeStatus === tab.key;
          const href =
            tab.key === "all"
              ? "/admin/payments?status=all"
              : `/admin/payments?status=${tab.key}`;
          return (
            <Link
              key={tab.key}
              href={href}
              className={[
                "px-4 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-b-2 border-primary text-primary"
                  : "text-text-muted hover:text-foreground",
              ].join(" ")}
            >
              {translate(dictionary, tab.labelKey)}
            </Link>
          );
        })}
      </div>

      {payments.length === 0 ? (
        <EmptyState
          title={translate(
            dictionary,
            activeStatus === "pending"
              ? "admin.payments.empty.pendingTitle"
              : activeStatus === "all"
                ? "admin.payments.empty.title"
                : "admin.payments.empty.filterTitle"
          )}
          description={translate(
            dictionary,
            activeStatus === "pending"
              ? "admin.payments.empty.pendingDescription"
              : "admin.payments.empty.description"
          )}
        />
      ) : (
        <>
          <Table columns={columns} data={payments} getRowId={(p) => p.id} />
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            dictionary={dictionary}
          />
        </>
      )}

      {detailTarget && (
        <PaymentDetailModal
          isOpen={true}
          onClose={() => setDetailTarget(null)}
          payment={detailTarget}
          locale={locale}
          dictionary={dictionary}
        />
      )}
    </div>
  );
}