// components/layout/nav-items.ts
//
// Single source of truth for the app's primary navigation.
// Consumed by Sidebar.tsx, BottomNav.tsx, and (for the mobile hamburger
// drawer) Header.tsx / DashboardShell.tsx. Nothing here is a route — every
// `href` maps to a real page under app/(dashboard)/**.

import {
  BarChart3,
  LayoutDashboard,
  Package,
  PiggyBank,
  CreditCard,
  Settings as SettingsIcon,
  ShoppingCart,
  Truck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { hasPermission, type Permission } from "@/lib/permissions";
import type { ModuleKey, UserRole } from "@/types";
import type { TranslationKey } from "@/lib/i18n";

// Literal union instead of `string` — prevents typos and enables
// exhaustive matching wherever a nav item is looked up by key.
export type NavItemKey =
  | "dashboard"
  | "pos"
  | "inventory"
  | "suppliers"
  | "customers"
  | "reports"
  | "profitFund"
  | "staff"
  | "billing"
  | "settings";

export interface NavItem {
  key: NavItemKey;
  href: string;
  // Typed against TranslationKey so renaming/removing a key in
  // locales/*.json fails the build, not just the runtime.
  translationKey: TranslationKey;
  icon: LucideIcon;
  // null → item is not module-gated (Dashboard, Settings).
  // Non-null → item only renders if the Business record enables this module.
  requiredModule: ModuleKey | null;
  // null → no permission check (Dashboard is always visible to authenticated
  // users; its content adapts to role at the API/data layer, not here).
  // Non-null → item only renders if hasPermission(role, requiredPermission).
  requiredPermission: Permission | null;
}

// Order here is the display order in both Sidebar and BottomNav.
// "logout" is deliberately NOT a NavItem — it's an action, not a route,
// and lives in the header's account menu + the drawer footer.
export const NAV_ITEMS: readonly NavItem[] = [
  {
    key: "dashboard",
    href: "/dashboard",
    translationKey: "nav.dashboard",
    icon: LayoutDashboard,
    requiredModule: null,
    requiredPermission: null,
  },
  {
    key: "pos",
    href: "/pos",
    translationKey: "nav.pos",
    icon: ShoppingCart,
    requiredModule: "pos",
    requiredPermission: "pos.access",
  },
  {
    key: "inventory",
    href: "/inventory",
    translationKey: "nav.inventory",
    icon: Package,
    requiredModule: "inventory",
    requiredPermission: "inventory.view",
  },
  {
    key: "suppliers",
    href: "/suppliers",
    translationKey: "nav.suppliers",
    icon: Truck,
    requiredModule: "suppliers",
    requiredPermission: "suppliers.view",
  },
  {
    key: "customers",
    href: "/customers",
    translationKey: "nav.customers",
    icon: Users,
    requiredModule: "customers",
    requiredPermission: "customers.view",
  },
  {
    key: "reports",
    href: "/reports",
    translationKey: "nav.reports",
    icon: BarChart3,
    requiredModule: "reports",
    requiredPermission: "reports.view",
  },
  {
    key: "profitFund",
    href: "/profit-fund",
    translationKey: "nav.profitFund",
    icon: PiggyBank,
    requiredModule: "profitFund",
    requiredPermission: "profitFund.view",
  },
  {
    key: "staff",
    href: "/staff",
    translationKey: "nav.staff",
    icon: UserCog,
    requiredModule: "staff",
    requiredPermission: "staff.manage",
  },
    {
    key: "billing",
    href: "/billing",
    translationKey: "nav.billing",
    icon: CreditCard,
    // Not a tenant module — this is platform-level billing, always
    // present. Gated purely by the settings.manage permission (owner only).
    requiredModule: null,
    requiredPermission: "settings.manage",
  },
  {
    key: "settings",
    href: "/settings",
    translationKey: "nav.settings",
    icon: SettingsIcon,
    // Settings is not a toggleable module — it's always part of the app,
    // gated purely by the settings.manage permission.
    requiredModule: null,
    requiredPermission: "settings.manage",
  },
];

// Filters NAV_ITEMS against the tenant's enabled modules AND the user's role.
// Runs server-side in app/(dashboard)/layout.tsx so the client never has to
// know about ModuleKey/Permission — it just receives the resulting list.
export function getVisibleNavItems(
  enabledModules: ModuleKey[],
  role: UserRole
): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    if (
      item.requiredModule !== null &&
      !enabledModules.includes(item.requiredModule)
    ) {
      return false;
    }
    if (
      item.requiredPermission !== null &&
      !hasPermission(role, item.requiredPermission)
    ) {
      return false;
    }
    return true;
  });
}