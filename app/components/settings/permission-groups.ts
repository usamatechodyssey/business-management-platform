// app/components/settings/permission-groups.ts
//
// Presentation-only grouping of the permissions defined in
// lib/permissions.ts. Kept separate so lib/permissions.ts stays pure data
// (permission list + role matrix) — grouping and translation keys are a
// UI concern.
//
// Order matches the sidebar: POS → Inventory → Suppliers → Customers →
// Reports → Profit Fund → Staff → Settings. Owner reading the table top-
// to-bottom sees modules in the same order they navigate them.

import type { Permission } from "@/lib/permissions";
import type { TranslationKey } from "@/lib/i18n";

export interface PermissionGroupItem {
  key: Permission;
  labelKey: TranslationKey;
}

export interface PermissionGroup {
  key: string;
  labelKey: TranslationKey;
  permissions: PermissionGroupItem[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: "pos",
    labelKey: "permissions.groups.pos",
    permissions: [
      { key: "pos.access", labelKey: "permissions.pos.access" },
    ],
  },
  {
    key: "inventory",
    labelKey: "permissions.groups.inventory",
    permissions: [
      { key: "inventory.view", labelKey: "permissions.inventory.view" },
      { key: "inventory.manage", labelKey: "permissions.inventory.manage" },
    ],
  },
  {
    key: "suppliers",
    labelKey: "permissions.groups.suppliers",
    permissions: [
      { key: "suppliers.view", labelKey: "permissions.suppliers.view" },
      { key: "suppliers.manage", labelKey: "permissions.suppliers.manage" },
    ],
  },
  {
    key: "customers",
    labelKey: "permissions.groups.customers",
    permissions: [
      { key: "customers.view", labelKey: "permissions.customers.view" },
      { key: "customers.manage", labelKey: "permissions.customers.manage" },
    ],
  },
  {
    key: "reports",
    labelKey: "permissions.groups.reports",
    permissions: [
      { key: "reports.view", labelKey: "permissions.reports.view" },
      {
        key: "reports.viewFinancials",
        labelKey: "permissions.reports.viewFinancials",
      },
    ],
  },
  {
    key: "profitFund",
    labelKey: "permissions.groups.profitFund",
    permissions: [
      {
        key: "profitFund.view",
        labelKey: "permissions.profitFund.view",
      },
      {
        key: "profitFund.manage",
        labelKey: "permissions.profitFund.manage",
      },
    ],
  },
  {
    key: "staff",
    labelKey: "permissions.groups.staff",
    permissions: [
      { key: "staff.manage", labelKey: "permissions.staff.manage" },
    ],
  },
  {
    key: "settings",
    labelKey: "permissions.groups.settings",
    permissions: [
      { key: "settings.manage", labelKey: "permissions.settings.manage" },
    ],
  },
];

// Order of roles in the table columns. Matches the hierarchy from top
// (owner, broadest) to bottom (accountant, narrowest after cashier).
export const ROLE_ORDER = ["owner", "manager", "cashier", "accountant"] as const;