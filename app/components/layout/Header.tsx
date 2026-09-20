// components/layout/Header.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import  LanguageSwitcher  from "./LanguageSwitcher";
import { NAV_ITEMS } from "./nav-items";
import {
  translate,
  type Dictionary,
  type Locale,
  type TranslationKey,
} from "@/lib/i18n";
import type { UserRole } from "@/types";

interface HeaderProps {
  dictionary: Dictionary;
  currentLocale: Locale;
  userName: string;
  userRole: UserRole;
  // Opens the mobile drawer (owned by DashboardShell).
  onOpenMenu: () => void;
  // Lifted to DashboardShell so this and Sidebar's logout button share
  // one handler — one POST /api/auth/logout, one redirect.
  onLogout: () => void;
  // Shared across Header + Sidebar so both disable during the same
  // in-flight logout.
  isLoggingOut: boolean;
}

// Typed against TranslationKey so a renamed/removed role label in
// locales/*.json fails the build.
const ROLE_KEY: Record<UserRole, TranslationKey> = {
  owner: "roles.owner",
  manager: "roles.manager",
  cashier: "roles.cashier",
  accountant: "roles.accountant",
};

// First + last word initials, uppercase. Falls back to "?" for empty
// names (defensive — User.name is required, but a runtime-bad session
// shouldn't render an empty circle).
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase() || "?";
}

// Derives the page title from NAV_ITEMS by matching the current pathname.
// Every (dashboard) route maps to exactly one nav item, so the title is
// always translated and always in sync with the sidebar label.
function getPageTitleKey(pathname: string): TranslationKey {
  const match = NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
  return match?.translationKey ?? "nav.dashboard";
}

export function Header({
  dictionary,
  currentLocale,
  userName,
  userRole,
  onOpenMenu,
  onLogout,
  isLoggingOut,
}: HeaderProps) {
  const pathname = usePathname();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close on outside pointer-down (mouse + touch unified) and on Escape.
  useEffect(() => {
    if (!isUserMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (
        target &&
        userMenuRef.current &&
        !userMenuRef.current.contains(target)
      ) {
        setIsUserMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsUserMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isUserMenuOpen]);

  // Close when the route changes — otherwise the menu can linger over a
  // freshly loaded page after a client-side navigation.
  useEffect(() => {
    setIsUserMenuOpen(false);
  }, [pathname]);

  const pageTitle = translate(dictionary, getPageTitleKey(pathname));
  const initials = getInitials(userName);

  function handleLogoutClick() {
    // Close first so the popover doesn't sit on top of the post-logout
    // redirect flicker.
    setIsUserMenuOpen(false);
    onLogout();
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-surface px-4">
      {/* Hamburger — mobile only. On lg+ the Sidebar is always visible,
          so opening a drawer would be redundant. */}
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label={translate(dictionary, "nav.openMenu")}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* Page title — flex-1 so it takes remaining space and truncates
          cleanly on narrow screens. */}
      <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
        {pageTitle}
      </h1>

      {/* Language toggle — always visible, on every viewport. */}
      <div className="shrink-0">
        <LanguageSwitcher
          currentLocale={currentLocale}
          dictionary={dictionary}
        />
      </div>

      {/* User menu — disclosure pattern (button + popover), not a WAI-ARIA
          menu: only one actionable item (logout), so role="menu" would
          promise arrow-key navigation we don't implement. */}
      <div ref={userMenuRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setIsUserMenuOpen((open) => !open)}
          aria-expanded={isUserMenuOpen}
          aria-controls="header-user-menu"
          aria-label={translate(dictionary, "header.accountMenuLabel")}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {initials}
        </button>

        {isUserMenuOpen && (
          <div
            id="header-user-menu"
            className="absolute end-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
          >
            <div className="border-b border-border px-4 py-3">
              <p className="text-xs text-text-muted">
                {translate(dictionary, "header.signedInAs")}
              </p>
              <p
                className="truncate text-sm font-semibold text-foreground"
                title={userName}
              >
                {userName}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                {translate(dictionary, ROLE_KEY[userRole])}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogoutClick}
              disabled={isLoggingOut}
              className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-danger transition-colors hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{translate(dictionary, "nav.logout")}</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}