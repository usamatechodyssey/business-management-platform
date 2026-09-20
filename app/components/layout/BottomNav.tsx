// components/layout/BottomNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { translate, type Dictionary } from "@/lib/i18n";
import type { NavItem } from "./nav-items";

interface BottomNavProps {
  // Already filtered server-side — same list Sidebar receives.
  items: NavItem[];
  dictionary: Dictionary;
  // Opens the mobile drawer (owned by DashboardShell). Only fires when the
  // More tab exists — see MAX_VISIBLE_ITEMS below.
  onOpenMenu: () => void;
  // Reflects the mobile drawer's open state (owned by DashboardShell), so
  // assistive tech knows the More tab controls an expanded region.
  isMobileNavOpen: boolean;
}

// 4 visible items + 1 More slot keeps every tap target ≥ 44px on a 375px
// viewport (WCAG 2.5.5). If a tenant has ≤ 4 items, no More slot renders
// and every item is directly reachable.
const MAX_VISIBLE_ITEMS = 4;

function isItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav({
  items,
  dictionary,
  onOpenMenu,
  isMobileNavOpen,
}: BottomNavProps) {
  const pathname = usePathname();

  const hasOverflow = items.length > MAX_VISIBLE_ITEMS;
  const visibleItems = hasOverflow
    ? items.slice(0, MAX_VISIBLE_ITEMS)
    : items;
  const overflowItems = hasOverflow
    ? items.slice(MAX_VISIBLE_ITEMS)
    : [];

  // "More" is marked active when the current route lives in the overflow —
  // otherwise the user has no visual cue that their current page is
  // reachable behind the More tab.
  const isMoreActive = overflowItems.some((item) =>
    isItemActive(pathname, item.href)
  );

  return (
    <nav
      aria-label={translate(dictionary, "nav.mobileLabel")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="flex h-16 items-stretch">
        {visibleItems.map((item) => {
          const isActive = isItemActive(pathname, item.href);
          const Icon = item.icon;
          const label = translate(dictionary, item.translationKey);

          return (
            <li key={item.key} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "flex h-full flex-col items-center justify-center gap-1 px-1",
                  "text-[11px] font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
                  isActive ? "text-primary" : "text-text-muted",
                ].join(" ")}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="w-full truncate text-center leading-none">
                  {label}
                </span>
              </Link>
            </li>
          );
        })}

        {hasOverflow && (
          <li className="flex-1">
            <button
              type="button"
              onClick={onOpenMenu}
              aria-haspopup="dialog"
              aria-expanded={isMobileNavOpen}
              className={[
                "flex h-full w-full flex-col items-center justify-center gap-1 px-1",
                "text-[11px] font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
                isMoreActive ? "text-primary" : "text-text-muted",
              ].join(" ")}
            >
              <Menu className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="w-full truncate text-center leading-none">
                {translate(dictionary, "nav.more")}
              </span>
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}