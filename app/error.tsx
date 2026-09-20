// app/error.tsx
"use client";

import { ErrorFallback } from "@/app/components/layout/ErrorFallback";

interface AppErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// Root-level error boundary. Catches errors thrown by child layouts —
// notably app/(dashboard)/layout.tsx's TenantError, which the
// (dashboard)/error.tsx boundary cannot catch (same-segment limitation).
export default function AppError({ error, reset }: AppErrorProps) {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <ErrorFallback error={error} reset={reset} />
    </main>
  );
}