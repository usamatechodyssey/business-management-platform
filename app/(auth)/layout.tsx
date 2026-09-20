// app/(auth)/layout.tsx
//
// Shared chrome for /login and /register. Server Component — reads the
// locale cookie, feeds the client LanguageSwitcher, and renders both
// pages inside a centered card. Kept out of app/layout.tsx deliberately:
// the dashboard already has its own chrome, and the root layout must
// stay neutral so it can host all three sections.

import type { ReactNode } from "react";
import { translate, getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import  LanguageSwitcher  from "@/app/components/layout/LanguageSwitcher";

export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const locale = await getLocale();
  const dictionary = getDictionary(locale);

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-8">
      {/* Language toggle — top-right, always visible, works before login
          because setLocale() writes a cookie independent of session auth. */}
      <div className="absolute end-4 top-4">
        <LanguageSwitcher currentLocale={locale} dictionary={dictionary} />
      </div>

      <div className="w-full max-w-md">
        {/* Brand — sourced from the dictionary so no hardcoded string
            lives in JSX. The Urdu value is intentionally identical, since
            product names are brand identifiers, not translatable copy. */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-foreground">
            {translate(dictionary, "auth.appName")}
          </h1>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}