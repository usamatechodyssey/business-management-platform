// app/admin/(dashboard)/AdminHeader.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LogOut,
  ExternalLink,
  ScrollText,
  CreditCard,
  Layers,
  Settings as SettingsIcon,
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/app/components/ui/Toast";
import { translate, type Dictionary } from "@/lib/i18n";


interface AdminHeaderProps {
  adminName: string;
  pendingPayments: number;
  dictionary: Dictionary;
}

export function AdminHeader({
  adminName,
  pendingPayments,
  dictionary,
}: AdminHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { push: pushToast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
      router.push("/admin/login");
      router.refresh();
    } catch {
      setIsLoggingOut(false);
      pushToast({
        message: translate(dictionary, "errors.generic"),
        variant: "error",
      });
    }
  }

  const isPaymentsActive = pathname.startsWith("/admin/payments");
  const isPlansActive = pathname.startsWith("/admin/plans");
  const isActionsActive = pathname.startsWith("/admin/actions");
  const isSettingsActive = pathname.startsWith("/admin/settings");

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-surface px-4">
      <div className="flex items-center gap-3">
        <Link
          href="/admin"
          className="text-sm font-semibold text-foreground hover:text-primary"
        >
          {translate(dictionary, "admin.header.brand")}
        </Link>
        <span className="hidden text-xs text-text-muted sm:inline">
          {adminName}
        </span>
      </div>

      <nav className="flex items-center gap-1">
        <Link
          href="/admin/payments"
          className={[
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
            isPaymentsActive
              ? "bg-primary/10 text-primary"
              : "text-text-muted hover:bg-surface-muted hover:text-foreground",
          ].join(" ")}
        >
          <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">
            {translate(dictionary, "admin.header.payments")}
          </span>
          {pendingPayments > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-semibold text-white">
              {pendingPayments > 99 ? "99+" : pendingPayments}
            </span>
          )}
        </Link>

        <Link
          href="/admin/plans"
          className={[
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
            isPlansActive
              ? "bg-primary/10 text-primary"
              : "text-text-muted hover:bg-surface-muted hover:text-foreground",
          ].join(" ")}
        >
          <Layers className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">
            {translate(dictionary, "admin.header.plans")}
          </span>
        </Link>

        <Link
          href="/admin/actions"
          className={[
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
            isActionsActive
              ? "bg-primary/10 text-primary"
              : "text-text-muted hover:bg-surface-muted hover:text-foreground",
          ].join(" ")}
        >
          <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">
            {translate(dictionary, "admin.actions.title")}
          </span>
        </Link>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">
            {translate(dictionary, "admin.header.viewSite")}
          </span>
        </Link>
        <Link
          href="/admin/settings"
          className={[
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
            isSettingsActive
              ? "bg-primary/10 text-primary"
              : "text-text-muted hover:bg-surface-muted hover:text-foreground",
          ].join(" ")}
        >
          <SettingsIcon className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">
            {translate(dictionary, "admin.header.settings")}
          </span>
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-60"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">
            {translate(dictionary, "admin.header.logout")}
          </span>
        </button>
      </nav>
    </header>
  );
}