// components/layout/DashboardShell.tsx
"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { useToast } from "@/app/components/ui/Toast";
import { translate, type Dictionary, type Locale } from "@/lib/i18n";
import type { NavItem } from "./nav-items";
import type { UserRole } from "@/types";

interface DashboardShellProps {
  children: ReactNode;
  // All server-provided — this component never reads cookies or the DB.
  dictionary: Dictionary;
  currentLocale: Locale;
  businessName: string;
  userName: string;
  userRole: UserRole;
  // Already filtered server-side by module + role.
  items: NavItem[];
}

export function DashboardShell({
  children,
  dictionary,
  currentLocale,
  businessName,
  userName,
  userRole,
  items,
}: DashboardShellProps) {
  const router = useRouter();
  const { push: pushToast } = useToast();

  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const drawerRef = useRef<HTMLDivElement>(null);

  const closeMobileNav = useCallback(() => setIsMobileNavOpen(false), []);
  const openMobileNav = useCallback(() => setIsMobileNavOpen(true), []);

  // Drawer side-effects: Escape to close, body-scroll lock, focus the
  // drawer on open and restore the previously focused element on close.
  // Mirrors the pattern already used by components/ui/Modal.tsx.
  useEffect(() => {
    if (!isMobileNavOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    drawerRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsMobileNavOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [isMobileNavOpen]);

  // Single logout entry point shared by Header's account menu and the
  // Sidebar footer. Nothing here is optimistic: we wait for the server to
  // clear the session cookie, then navigate. A failed request surfaces a
  // toast instead of redirecting to /login with a still-valid session.
  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        throw new Error(`Logout failed with status ${response.status}`);
      }
      router.push("/login");
      // Re-runs the server tree with the now-cleared session cookie so
      // cached Server Component output can't briefly flash back in.
      router.refresh();
    } catch {
      setIsLoggingOut(false);
      pushToast({
        message: translate(dictionary, "errors.generic"),
        variant: "error",
      });
    }
  }, [dictionary, isLoggingOut, pushToast, router]);

  // Portal target must exist before we try to render into it — guard
  // against SSR, same as Toast.tsx and Modal.tsx.
  const canPortal = typeof document !== "undefined";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header
        dictionary={dictionary}
        currentLocale={currentLocale}
        userName={userName}
        userRole={userRole}
        onOpenMenu={openMobileNav}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      />

      <div className="flex flex-1">
        {/* Desktop sidebar — hidden below lg. `flex` (not `block`) so the
            Sidebar's h-full stretches to match content height. */}
        <aside className="hidden border-e border-border bg-surface lg:flex lg:w-64 lg:shrink-0">
          <Sidebar
            items={items}
            dictionary={dictionary}
            businessName={businessName}
            onLogout={handleLogout}
            isLoggingOut={isLoggingOut}
          />
        </aside>

        {/* Main content. pb-16 offsets the fixed BottomNav on mobile;
            removed at lg because the nav itself is hidden there. */}
        <main className="min-w-0 flex-1 pb-16 lg:pb-0">{children}</main>
      </div>

      <BottomNav
        items={items}
        dictionary={dictionary}
        onOpenMenu={openMobileNav}
        isMobileNavOpen={isMobileNavOpen}
      />

      {isMobileNavOpen &&
        canPortal &&
        createPortal(
          <div
            className="fixed inset-0 z-50 lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label={translate(dictionary, "nav.primaryLabel")}
          >
            <div
              className="absolute inset-0 bg-black/50"
              onClick={closeMobileNav}
              aria-hidden="true"
            />
            <div
              ref={drawerRef}
              tabIndex={-1}
              className="absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-xl focus:outline-none"
            >
              <Sidebar
                items={items}
                dictionary={dictionary}
                businessName={businessName}
                onNavigate={closeMobileNav}
                onRequestClose={closeMobileNav}
                onLogout={handleLogout}
                isLoggingOut={isLoggingOut}
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}