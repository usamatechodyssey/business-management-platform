// app/components/layout/TrialWarningBanner.tsx
//
// Thin banner that appears above the dashboard shell when a trial (or
// paid subscription) is approaching expiry. Uses platform-settings
// `trialWarningDays` to decide whether to render. Rendered server-side
// — no client state needed.

import Link from "next/link";
import { Clock } from "lucide-react";
import { translate, type Dictionary } from "@/lib/i18n";

interface TrialWarningBannerProps {
  daysLeft: number;
  dictionary: Dictionary;
}

export function TrialWarningBanner({
  daysLeft,
  dictionary,
}: TrialWarningBannerProps) {
  // Copy varies by urgency: today / tomorrow / N days.
  const message =
    daysLeft <= 0
      ? translate(dictionary, "trialWarning.today")
      : daysLeft === 1
        ? translate(dictionary, "trialWarning.tomorrow")
        : translate(dictionary, "trialWarning.daysLeft", { count: daysLeft });

  return (
    <div className="sticky top-16 z-20 flex items-center justify-between gap-2 border-b border-warning/40 bg-warning/15 px-4 py-2">
      <div className="flex items-center gap-2 text-sm text-warning">
        <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="font-medium">{message}</span>
      </div>
      <Link
        href="/billing"
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-warning/40 bg-surface px-2.5 py-1 text-xs font-medium text-warning transition-colors hover:bg-warning/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning"
      >
        {translate(dictionary, "trialWarning.renewCta")}
      </Link>
    </div>
  );
}