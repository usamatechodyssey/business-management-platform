// app/components/layout/SubscriptionBlocked.tsx
//
// Full-page screen shown instead of the dashboard when a tenant's
// subscription has lapsed (expired trial, expired paid plan, or an
// admin-imposed suspension). Renders standalone — the caller returns it
// *instead of* children so no shell is mounted.
//
// Client Component: contains an inline logout button that needs a click
// handler. Server Components can't pass event handlers to JSX.

"use client";
import { AlertTriangle, LogOut, MessageCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { translate, type Dictionary } from "@/lib/i18n";
import { normalizePhoneForWhatsApp } from "@/lib/whatsapp";
import type { PlatformSettings } from "@/types";

interface SubscriptionBlockedProps {
  variant: "suspended" | "expired";
  reason?: string;
  platform: PlatformSettings;
  dictionary: Dictionary;
}

// Builds a WhatsApp link to platform support, using the pre-filled
// message that names the tenant's situation. Falls back to null when
// no support number is configured.
function buildSupportLink(platform: PlatformSettings, message: string): string | null {
  const phone = normalizePhoneForWhatsApp(platform.supportWhatsApp);
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function SubscriptionBlocked({
  variant,
  reason,
  platform,
  dictionary,
}: SubscriptionBlockedProps) {
  // Text resolution order: admin override → locale strings.
  const title =
    platform.blockedTitleOverride ??
    (variant === "suspended"
      ? translate(dictionary, "subscriptionBlocked.suspended.title")
      : translate(dictionary, "subscriptionBlocked.expired.title"));

  const description =
    platform.blockedDescriptionOverride ??
    (variant === "suspended"
      ? translate(dictionary, "subscriptionBlocked.suspended.description")
      : translate(dictionary, "subscriptionBlocked.expired.description"));

  const supportLink =
    platform.supportWhatsApp || platform.supportEmail
      ? buildSupportLink(
          platform,
          `Hi, I need help with my Business Manager subscription.`
        )
      : null;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger">
            <AlertTriangle className="h-7 w-7" aria-hidden="true" />
          </div>

          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-text-muted">{description}</p>

          {variant === "suspended" && reason && (
            <p className="mt-1 w-full rounded-lg bg-surface-muted px-3 py-2 text-xs text-text-muted">
              {reason}
            </p>
          )}

          {/* Primary actions */}
          <div className="mt-3 flex w-full flex-col gap-2">
            <Link
              href="/billing"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {translate(dictionary, "subscriptionBlocked.renewCta")}
            </Link>

            {supportLink && (
              <a
                href={supportLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                {translate(dictionary, "subscriptionBlocked.contactSupport")}
              </a>
            )}

            <button
              type="button"
              onClick={() => {
                void fetch("/api/auth/logout", { method: "POST" }).then(() => {
                  window.location.href = "/login";
                });
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {translate(dictionary, "nav.logout")}
            </button>
          </div>

          {platform.supportEmail && (
            <p className="mt-2 text-xs text-text-muted">
              {translate(dictionary, "subscriptionBlocked.emailHint", {
                email: platform.supportEmail,
              })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}