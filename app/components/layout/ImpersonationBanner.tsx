// app/components/layout/ImpersonationBanner.tsx
//
// Rendered at the top of the business dashboard when an admin is
// impersonating a tenant. The exit button clears both the impersonation
// session cookie and the marker cookie, then returns the admin to
// /admin.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, LogOut } from "lucide-react";
import { useToast } from "@/app/components/ui/Toast";
import { translate, type Dictionary } from "@/lib/i18n";

interface ImpersonationBannerProps {
  businessName: string;
  dictionary: Dictionary;
}

export function ImpersonationBanner({
  businessName,
  dictionary,
}: ImpersonationBannerProps) {
  const router = useRouter();
  const { push } = useToast();
  const [isExiting, setIsExiting] = useState(false);

  async function handleExit() {
    if (isExiting) return;
    setIsExiting(true);
    try {
      const response = await fetch("/api/admin/impersonate/exit", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`Exit failed (${response.status})`);
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setIsExiting(false);
      push({
        message: translate(dictionary, "errors.generic"),
        variant: "error",
      });
    }
  }

  return (
    <div className="sticky top-16 z-20 flex items-center justify-between gap-2 border-b border-warning/40 bg-warning/15 px-4 py-2">
      <div className="flex items-center gap-2 text-sm text-warning">
        <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="font-medium">
          {translate(dictionary, "admin.impersonationBanner.text", {
            businessName,
          })}
        </span>
      </div>
      <button
        type="button"
        onClick={handleExit}
        disabled={isExiting}
        className="inline-flex items-center gap-1 rounded-md border border-warning/40 bg-surface px-2.5 py-1 text-xs font-medium text-warning transition-colors hover:bg-warning/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning disabled:cursor-not-allowed disabled:opacity-60"
      >
        <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
        {translate(dictionary, "admin.impersonationBanner.exit")}
      </button>
    </div>
  );
}