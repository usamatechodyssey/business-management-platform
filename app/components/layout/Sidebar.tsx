// components/layout/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, X } from "lucide-react";
import { translate, type Dictionary } from "@/lib/i18n";
import type { NavItem } from "./nav-items";

interface SidebarProps {
  // Already filtered server-side — Sidebar never checks modules/permissions.
  items: NavItem[];
  dictionary: Dictionary;
  // Shown at the top of the sidebar; sourced from the tenant's Business
  // record in app/(dashboard)/layout.tsx, never hardcoded.
  businessName: string;
  // Called when a nav link is tapped. Used by the mobile drawer to close
  // itself; undefined on desktop (nothing to close).
  onNavigate?: () => void;
  // Only provided when rendered inside the mobile drawer. When set, the
  // sidebar header renders a close button; on desktop this stays undefined
  // so no close affordance appears where there's nothing to close.
  onRequestClose?: () => void;
  // Lifted to DashboardShell so Header's account menu and this button
  // share one handler (one POST /api/auth/logout, one redirect).
  onLogout: () => void;
  // Shared across Header + Sidebar so both disable during the same
  // in-flight logout, preventing double-submits.
  isLoggingOut: boolean;
}

// Matches both the exact route and its nested routes:
//   "/customers"    → active on /customers
//   "/customers/42" → active on /customers/42
// Avoids false positives like "/customers-something" because of the
// explicit trailing slash requirement.
function isItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  items,
  dictionary,
  businessName,
  onNavigate,
  onRequestClose,
  onLogout,
  isLoggingOut,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={translate(dictionary, "nav.primaryLabel")}
      className="flex h-full w-full flex-col"
    >
      {/* Business name + optional close button (drawer only). Truncate +
          title for long names, no layout jump. */}
      <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
        <p
          className="min-w-0 truncate text-base font-semibold text-foreground"
          title={businessName}
        >
          {businessName}
        </p>
        {onRequestClose && (
          <button
            type="button"
            onClick={onRequestClose}
            aria-label={translate(dictionary, "nav.closeMenu")}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Scrollable nav list — middle section grows, footer stays pinned. */}
      <ul className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const isActive = isItemActive(pathname, item.href);
          const Icon = item.icon;
          const label = translate(dictionary, item.translationKey);

          return (
            <li key={item.key}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-text-muted hover:bg-surface-muted hover:text-foreground",
                ].join(" ")}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Footer — logout is an action, not a route, so it lives outside
          the <ul> that renders nav links. */}
      <div className="shrink-0 border-t border-border p-3">
        <button
          type="button"
          onClick={onLogout}
          disabled={isLoggingOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="truncate">{translate(dictionary, "nav.logout")}</span>
        </button>
      </div>
    </nav>
  );
}