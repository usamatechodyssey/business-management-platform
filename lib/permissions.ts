import type { UserRole } from "@/types";

export type Permission =
  | "pos.access"
  | "inventory.view"
  | "inventory.manage"
  | "suppliers.view"
  | "suppliers.manage"
  | "customers.view"
  | "customers.manage"
  | "reports.view"
  | "reports.viewFinancials"
  | "profitFund.view"
  | "profitFund.manage"
  | "staff.manage"
  | "settings.manage";

const ALL_PERMISSIONS: Permission[] = [
  "pos.access", "inventory.view", "inventory.manage",
  "suppliers.view", "suppliers.manage",
  "customers.view", "customers.manage",
  "reports.view", "reports.viewFinancials",
  "profitFund.view", "profitFund.manage",
  "staff.manage", "settings.manage",
];

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: ALL_PERMISSIONS,
  manager: [
    "pos.access", "inventory.view", "inventory.manage",
    "suppliers.view", "suppliers.manage",
    "customers.view", "customers.manage",
    "reports.view", "reports.viewFinancials",
    "profitFund.view",
  ],
  cashier: ["pos.access", "inventory.view", "customers.view"],
  accountant: [
    "customers.view", "suppliers.view",
    "reports.view", "reports.viewFinancials",
    "profitFund.view", "profitFund.manage",
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role];
}