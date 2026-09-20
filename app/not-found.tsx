// app/not-found.tsx
//
// Global 404. Renders inside the root layout's <body>, but OUTSIDE the
// (dashboard) chrome — so it stands alone. Server Component.

import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { getDictionary, translate } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export default async function NotFound() {
  const locale = await getLocale();
  const dictionary = getDictionary(locale);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted text-text-muted">
        <FileQuestion className="h-8 w-8" aria-hidden="true" />
      </div>
      <h1 className="text-lg font-semibold text-foreground">
        {translate(dictionary, "errors.pageNotFoundTitle")}
      </h1>
      <p className="max-w-sm text-sm text-text-muted">
        {translate(dictionary, "errors.pageNotFoundDescription")}
      </p>
      <Link
        href="/dashboard"
        className="mt-2 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-base font-medium text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        {translate(dictionary, "nav.dashboard")}
      </Link>
    </main>
  );
}