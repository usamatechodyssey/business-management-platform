// app/(dashboard)/error.tsx
"use client";

import { ErrorFallback } from "@/app/components/layout/ErrorFallback";

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// Catches errors thrown by pages inside the (dashboard) segment. Renders
// inside DashboardShell, so the header / sidebar / bottom nav stay visible
// and the user can navigate away without a full reload.
export default function DashboardError({ error, reset }: DashboardErrorProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <ErrorFallback error={error} reset={reset} />
    </div>
  );
}