// lib/i18n-actions.ts
//
// Isolated in its own file (whole-file "use server" directive) — the
// documented, zero-ambiguity way to define a Server Action that's imported
// directly into a Client Component (see reasoning above).

"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE_NAME, isLocale, type Locale } from "@/lib/i18n";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function setLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) {
    throw new Error(`Invalid locale: "${locale}"`);
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, locale, {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
  });
}