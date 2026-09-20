// app/components/ui/Pagination.tsx
"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { translate, type Dictionary } from "@/lib/i18n";

interface PaginationProps {
  page: number;
  totalPages: number;
  dictionary: Dictionary;
}

// Reads the current path + search params so preserved filters (query,
// category, lowStock, etc.) survive page changes. Renders nothing when
// there's only one page — avoids a dead row in the UI.
export function Pagination({ page, totalPages, dictionary }: PaginationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  function hrefFor(targetPage: number): string {
    const params = new URLSearchParams(searchParams.toString());
    // Page 1 is the default — keep the URL clean by omitting it.
    if (targetPage <= 1) params.delete("page");
    else params.set("page", String(targetPage));
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav
      aria-label={translate(dictionary, "common.paginationLabel")}
      className="flex items-center justify-between gap-3 pt-2"
    >
      <Link
        href={hrefFor(page - 1)}
        aria-disabled={!hasPrev}
        tabIndex={hasPrev ? undefined : -1}
        className={[
          "inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-surface px-3 text-sm font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          hasPrev
            ? "text-foreground hover:bg-surface-muted"
            : "pointer-events-none text-text-muted opacity-50",
        ].join(" ")}
      >
        <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        {translate(dictionary, "common.previous")}
      </Link>

      <p className="text-sm text-text-muted">
        {translate(dictionary, "common.pageOf", {
          page,
          total: totalPages,
        })}
      </p>

      <Link
        href={hrefFor(page + 1)}
        aria-disabled={!hasNext}
        tabIndex={hasNext ? undefined : -1}
        className={[
          "inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-surface px-3 text-sm font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          hasNext
            ? "text-foreground hover:bg-surface-muted"
            : "pointer-events-none text-text-muted opacity-50",
        ].join(" ")}
      >
        {translate(dictionary, "common.next")}
        <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
      </Link>
    </nav>
  );
}