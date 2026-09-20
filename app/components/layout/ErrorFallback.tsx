// components/layout/ErrorFallback.tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";
import { useLocale } from "./LocaleProvider";
import { Button } from "@/app/components/ui/Button";
import { translate } from "@/lib/i18n";

interface ErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// Shared body for both app/error.tsx and app/(dashboard)/error.tsx. Owns
// the console logging and the retry/dashboard actions; the surrounding page
// files decide only the outer layout (full-screen vs. inside dashboard).
export function ErrorFallback({ error, reset }: ErrorFallbackProps) {
  const { dictionary } = useLocale();

  useEffect(() => {
    // In production, Server Component error messages are redacted and a
    // digest is attached. Logging the digest lets an operator match this
    // client-side report against the server log line.
    console.error("[app-error]", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger">
        <AlertTriangle className="h-7 w-7" aria-hidden="true" />
      </div>
      <h1 className="text-lg font-semibold text-foreground">
        {translate(dictionary, "errors.generic")}
      </h1>
      {error.digest && (
        <p className="font-mono text-xs text-text-muted">
          {translate(dictionary, "errors.reference")}: {error.digest}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          variant="primary"
          onClick={reset}
          leadingIcon={<RotateCw className="h-4 w-4" aria-hidden="true" />}
        >
          {translate(dictionary, "common.retry")}
        </Button>
        <Link
          href="/dashboard"
          className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-surface px-4 text-base font-medium text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {translate(dictionary, "nav.dashboard")}
        </Link>
      </div>
    </div>
  );
}