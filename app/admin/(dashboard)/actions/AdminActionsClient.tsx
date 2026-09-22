// app/admin/(dashboard)/actions/AdminActionsClient.tsx

"use client";

import Link from "next/link";
import { Badge } from "@/app/components/ui/Badge";
import { Pagination } from "@/app/components/ui/Pagination";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { formatDate } from "@/lib/format";
import {
  translate,
  type Dictionary,
  type Locale,
  type TranslationKey,
} from "@/lib/i18n";
import type { AdminAction, AdminActionType } from "@/types";

interface AdminActionsClientProps {
  actions: AdminAction[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  locale: Locale;
  dictionary: Dictionary;
}

// Each action type gets a translated label + a semantic badge variant.
// Kept as a map so adding a new AdminActionType forces a compile error
// here until it's represented in the UI.
const ACTION_LABEL_KEY: Record<AdminActionType, TranslationKey> = {
  "admin.login": "admin.actions.types.adminLogin",
  "admin.logout": "admin.actions.types.adminLogout",
  "tenant.suspend": "admin.actions.types.tenantSuspend",
  "tenant.activate": "admin.actions.types.tenantActivate",
  "tenant.delete": "admin.actions.types.tenantDelete",
  "tenant.grant": "admin.actions.types.tenantGrant",
  "tenant.impersonate": "admin.actions.types.tenantImpersonate",
  "tenant.resetOwnerPassword": "admin.actions.types.tenantResetOwnerPassword",
  "payment.verify": "admin.actions.types.paymentVerify",
  "payment.reject": "admin.actions.types.paymentReject",
  "plan.create": "admin.actions.types.planCreate",
  "plan.update": "admin.actions.types.planUpdate",
  "plan.delete": "admin.actions.types.planDelete",
   "platform.settings.update": "admin.actions.types.platformSettingsUpdate",
};

function actionVariant(
  type: AdminActionType
): "primary" | "success" | "warning" | "danger" | "neutral" {
  if (type === "admin.login") return "success";
  if (type === "admin.logout") return "neutral";
  if (type === "tenant.suspend") return "warning";
  if (type === "tenant.activate") return "success";
  if (type === "tenant.delete") return "danger";
  if (type === "tenant.grant") return "primary";
  if (type === "tenant.impersonate") return "warning";
  if (type === "payment.verify") return "success";
  if (type === "payment.reject") return "danger";
  if (type === "plan.create") return "primary";
  if (type === "plan.update") return "primary";
  if (type === "plan.delete") return "danger";
  if (type === "platform.settings.update") return "primary";
  return "neutral";
}

// Renders the metadata as a compact key=value string list. Metadata is
// intentionally free-form, so we don't try to make it pretty — just
// readable.
function formatMetadata(
  metadata: AdminAction["metadata"]
): string | null {
  if (!metadata) return null;
  const entries = Object.entries(metadata);
  if (entries.length === 0) return null;
  return entries.map(([k, v]) => `${k}: ${v}`).join(" · ");
}

export function AdminActionsClient({
  actions,
  pagination,
  locale,
  dictionary,
}: AdminActionsClientProps) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          {translate(dictionary, "admin.actions.title")}
        </h1>
        <p className="text-sm text-text-muted">
          {translate(dictionary, "admin.actions.subtitle")}
        </p>
      </div>

      {actions.length === 0 ? (
        <EmptyState
          title={translate(dictionary, "admin.actions.empty.title")}
          description={translate(
            dictionary,
            "admin.actions.empty.description"
          )}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-xl border border-border lg:block">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted">
                <tr>
                  <th className="px-4 py-3 text-start font-medium text-text-muted">
                    {translate(dictionary, "admin.actions.columns.when")}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-text-muted">
                    {translate(dictionary, "admin.actions.columns.admin")}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-text-muted">
                    {translate(dictionary, "admin.actions.columns.action")}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-text-muted">
                    {translate(dictionary, "admin.actions.columns.target")}
                  </th>
                  <th className="px-4 py-3 text-start font-medium text-text-muted">
                    {translate(dictionary, "admin.actions.columns.details")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {actions.map((action) => {
                  const meta = formatMetadata(action.metadata);
                  return (
                    <tr
                      key={action.id}
                      className="border-t border-border hover:bg-surface-muted/50"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-text-muted">
                        {formatDate(action.createdAt, locale)}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {action.adminName}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={actionVariant(action.type)}>
                          {translate(dictionary, ACTION_LABEL_KEY[action.type])}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {action.targetBusinessId ? (
                          <Link
                            href={`/admin/tenants/${action.targetBusinessId}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {action.targetBusinessName ??
                              action.targetBusinessId.slice(0, 8)}
                          </Link>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-muted">
                        {meta ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="flex flex-col gap-3 lg:hidden">
            {actions.map((action) => {
              const meta = formatMetadata(action.metadata);
              return (
                <li
                  key={action.id}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant={actionVariant(action.type)}>
                      {translate(dictionary, ACTION_LABEL_KEY[action.type])}
                    </Badge>
                    <span className="text-xs text-text-muted">
                      {formatDate(action.createdAt, locale)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">
                    <span className="text-text-muted">
                      {translate(dictionary, "admin.actions.columns.admin")}:{" "}
                    </span>
                    {action.adminName}
                  </p>
                  {action.targetBusinessId && (
                    <p className="text-sm">
                      <span className="text-text-muted">
                        {translate(
                          dictionary,
                          "admin.actions.columns.target"
                        )}
                        :{" "}
                      </span>
                      <Link
                        href={`/admin/tenants/${action.targetBusinessId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {action.targetBusinessName ??
                          action.targetBusinessId.slice(0, 8)}
                      </Link>
                    </p>
                  )}
                  {meta && (
                    <p className="text-xs text-text-muted">{meta}</p>
                  )}
                </li>
              );
            })}
          </ul>

          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            dictionary={dictionary}
          />
        </>
      )}
    </div>
  );
}