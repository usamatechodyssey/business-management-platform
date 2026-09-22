// app/components/settings/RolesTab.tsx
//
// Read-only reference matrix showing what each role can do. Source of
// truth is lib/permissions.ts — this file never defines permissions
// itself, it only renders them. If the role matrix changes in
// lib/permissions.ts, this view updates automatically.
//
// Layout:
//   Desktop (lg+): grouped table — module header rows, then permission
//                  rows with four role columns of ✓ / ✗.
//   Mobile (<lg):  one card per role, each listing permissions grouped
//                  by module.

"use client";

import { Check, X } from "lucide-react";
import { getPermissionsForRole } from "@/lib/permissions";
import { translate, type Dictionary, type TranslationKey } from "@/lib/i18n";
import {
  PERMISSION_GROUPS,
  ROLE_ORDER,
} from "./permission-groups";
import type { UserRole } from "@/types";

interface RolesTabProps {
  dictionary: Dictionary;
}

const ROLE_LABEL_KEY: Record<UserRole, TranslationKey> = {
  owner: "roles.owner",
  manager: "roles.manager",
  cashier: "roles.cashier",
  accountant: "roles.accountant",
};

// Yes/no marker used in the matrix. Green check for "has it", muted X for
// "doesn't". The sr-only text ensures screen readers announce the state
// — icons are decorative.
function YesNoMark({ value }: { value: boolean }) {
  return (
    <span className="inline-flex items-center justify-center">
      {value ? (
        <>
          <Check className="h-5 w-5 text-success" aria-hidden="true" />
          <span className="sr-only">Yes</span>
        </>
      ) : (
        <>
          <X className="h-5 w-5 text-text-muted/50" aria-hidden="true" />
          <span className="sr-only">No</span>
        </>
      )}
    </span>
  );
}

export function RolesTab({ dictionary }: RolesTabProps) {
  // Compute each role's permission set once. getPermissionsForRole returns
  // the source array from lib/permissions.ts — we convert to a Set for
  // O(1) lookups across many rows.
  const permissionsByRole: Record<UserRole, Set<string>> = {
    owner: new Set(getPermissionsForRole("owner")),
    manager: new Set(getPermissionsForRole("manager")),
    cashier: new Set(getPermissionsForRole("cashier")),
    accountant: new Set(getPermissionsForRole("accountant")),
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          {translate(dictionary, "settings.roles.heading")}
        </h2>
        <p className="mt-0.5 text-sm text-text-muted">
          {translate(dictionary, "settings.roles.description")}
        </p>
      </div>

      {/* Desktop — grouped table */}
      <div className="hidden overflow-x-auto rounded-xl border border-border lg:block">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted">
            <tr>
              <th
                scope="col"
                className="px-4 py-3 text-start font-medium text-text-muted"
              >
                {translate(dictionary, "settings.roles.tableHeader")}
              </th>
              {ROLE_ORDER.map((role) => (
                <th
                  key={role}
                  scope="col"
                  className="w-24 px-3 py-3 text-center font-medium text-text-muted"
                >
                  {translate(dictionary, ROLE_LABEL_KEY[role])}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map((group) => (
              <GroupRows
                key={group.key}
                groupLabelKey={group.labelKey}
                permissions={group.permissions}
                permissionsByRole={permissionsByRole}
                dictionary={dictionary}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile — one card per role */}
      <div className="grid grid-cols-1 gap-4 lg:hidden">
        {ROLE_ORDER.map((role) => (
          <div
            key={role}
            className="rounded-xl border border-border bg-surface p-4 shadow-sm"
          >
            <h3 className="text-base font-semibold text-foreground">
              {translate(dictionary, ROLE_LABEL_KEY[role])}
            </h3>

            <div className="mt-3 flex flex-col gap-4">
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.key}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {translate(dictionary, group.labelKey)}
                  </p>
                  <ul className="mt-1 divide-y divide-border">
                    {group.permissions.map((perm) => {
                      const has = permissionsByRole[role].has(perm.key);
                      return (
                        <li
                          key={perm.key}
                          className="flex items-start justify-between gap-3 py-2"
                        >
                          <span className="flex-1 text-sm text-foreground">
                            {translate(dictionary, perm.labelKey)}
                          </span>
                          <YesNoMark value={has} />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Renders a group header row followed by the permission rows for that
// module. Extracted for readability — the main table body stays a simple
// map over PERMISSION_GROUPS.
function GroupRows({
  groupLabelKey,
  permissions,
  permissionsByRole,
  dictionary,
}: {
  groupLabelKey: TranslationKey;
  permissions: { key: string; labelKey: TranslationKey }[];
  permissionsByRole: Record<UserRole, Set<string>>;
  dictionary: Dictionary;
}) {
  return (
    <>
      <tr className="border-t border-border bg-surface-muted/50">
        <td
          colSpan={1 + ROLE_ORDER.length}
          className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted"
        >
          {translate(dictionary, groupLabelKey)}
        </td>
      </tr>
      {permissions.map((perm) => (
        <tr key={perm.key} className="border-t border-border">
          <td className="px-4 py-3 text-foreground">
            {translate(dictionary, perm.labelKey)}
          </td>
          {ROLE_ORDER.map((role) => (
            <td key={role} className="px-3 py-3 text-center">
              <YesNoMark value={permissionsByRole[role].has(perm.key)} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}