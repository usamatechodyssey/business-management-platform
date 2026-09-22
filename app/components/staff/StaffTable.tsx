// app/components/staff/StaffTable.tsx
"use client";

import { Pencil, Power, PowerOff } from "lucide-react";
import { Table, type TableColumn } from "@/app/components/ui/Table";
import { Badge } from "@/app/components/ui/Badge";
import { formatDate } from "@/lib/format";
import { translate, type Dictionary, type Locale, type TranslationKey } from "@/lib/i18n";
import type { SafeUser, UserRole } from "@/types";

interface StaffTableProps {
  staff: SafeUser[];
  currentUserId: string;
  locale: Locale;
  dictionary: Dictionary;
  onEdit: (user: SafeUser) => void;
  onToggleActive: (user: SafeUser) => void;
}

const ROLE_KEY: Record<UserRole, TranslationKey> = {
  owner: "roles.owner",
  manager: "roles.manager",
  cashier: "roles.cashier",
  accountant: "roles.accountant",
};

function ActionButton({
  label,
  onClick,
  icon,
  tone = "neutral",
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  tone?: "neutral" | "primary" | "danger";
  disabled?: boolean;
}) {
  const toneClasses =
    tone === "danger"
      ? "hover:bg-danger/10 hover:text-danger"
      : "hover:bg-surface-muted hover:text-foreground";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={[
        "rounded-md p-1.5 text-text-muted transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text-muted",
        toneClasses,
      ].join(" ")}
    >
      {icon}
    </button>
  );
}

export function StaffTable({
  staff,
  currentUserId,
  locale,
  dictionary,
  onEdit,
  onToggleActive,
}: StaffTableProps) {
  const columns: TableColumn<SafeUser>[] = [
    {
      key: "name",
      header: translate(dictionary, "staff.columns.name"),
      render: (user) => {
        const isSelf = user.id === currentUserId;
        const isOwner = user.role === "owner";
        return (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{user.name}</span>
            {isOwner && (
              <Badge variant="primary">
                {translate(dictionary, "staff.badges.owner")}
              </Badge>
            )}
            {isSelf && (
              <Badge variant="neutral">
                {translate(dictionary, "staff.badges.you")}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: "phone",
      header: translate(dictionary, "staff.columns.phone"),
    },
    {
      key: "role",
      header: translate(dictionary, "staff.columns.role"),
      render: (user) => translate(dictionary, ROLE_KEY[user.role]),
    },
    {
      key: "active",
      header: translate(dictionary, "staff.columns.status"),
      render: (user) =>
        user.active ? (
          <Badge variant="success">
            {translate(dictionary, "common.active")}
          </Badge>
        ) : (
          <Badge variant="neutral">
            {translate(dictionary, "common.inactive")}
          </Badge>
        ),
    },
    {
      key: "lastLogin",
      header: translate(dictionary, "staff.columns.lastLogin"),
      render: (user) =>
        user.lastLogin ? (
          formatDate(user.lastLogin, locale)
        ) : (
          <span className="text-text-muted">
            {translate(dictionary, "staff.lastLoginNever")}
          </span>
        ),
    },
    {
      key: "id",
      header: translate(dictionary, "staff.columns.actions"),
      align: "end",
      render: (user) => {
        const isSelf = user.id === currentUserId;
        const isOwner = user.role === "owner";
        // Owner and self can't be deactivated/deleted. Both rules are
        // also enforced server-side; this is purely a UX signal.
        const canToggleActive = !isOwner && !isSelf;

        return (
          <div className="flex items-center justify-end gap-1">
            <ActionButton
              label={translate(dictionary, "staff.actions.edit")}
              onClick={() => onEdit(user)}
              icon={<Pencil className="h-4 w-4" aria-hidden="true" />}
            />
            <ActionButton
              label={translate(
                dictionary,
                user.active ? "staff.actions.deactivate" : "staff.actions.activate"
              )}
              onClick={() => onToggleActive(user)}
              icon={
                user.active ? (
                  <PowerOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Power className="h-4 w-4" aria-hidden="true" />
                )
              }
              tone={user.active ? "danger" : "neutral"}
              disabled={!canToggleActive}
            />
          </div>
        );
      },
    },
  ];

  return (
    <Table
      columns={columns}
      data={staff}
      getRowId={(user) => user.id}
    />
  );
}