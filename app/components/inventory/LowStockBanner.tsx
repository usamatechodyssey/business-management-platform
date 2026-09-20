// app/components/inventory/LowStockBanner.tsx

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { translate, type Dictionary } from "@/lib/i18n";

interface LowStockBannerProps {
  count: number;
  dictionary: Dictionary;
}

// Renders nothing at count 0 so callers don't need a conditional wrapper.
// Pluralization is handled by picking between two pre-written keys rather
// than a runtime plural rule, since lib/i18n.ts has no ICU support.
export function LowStockBanner({ count, dictionary }: LowStockBannerProps) {
  if (count === 0) return null;

  const titleKey =
    count === 1
      ? "inventory.lowStockBanner.titleOne"
      : "inventory.lowStockBanner.titleOther";

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
      <AlertTriangle
        className="h-5 w-5 shrink-0 text-warning"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          {translate(dictionary, titleKey, { count })}
        </p>
        <p className="text-xs text-text-muted">
          {translate(dictionary, "inventory.lowStockBanner.description")}
        </p>
      </div>
      <Link
        href="/inventory?lowStock=true"
        className="inline-flex h-9 shrink-0 items-center rounded-lg border border-warning/40 bg-surface px-3 text-sm font-medium text-warning transition-colors hover:bg-warning/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning"
      >
        {translate(dictionary, "inventory.lowStockBanner.viewAll")}
      </Link>
    </div>
  );
}