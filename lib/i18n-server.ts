// lib/i18n-server.ts
//
// Server-only i18n helpers. The `next/headers` import makes this module
// unsafe to import from any Client Component — that is deliberate: it
// keeps the server-only surface out of the shared, client-safe
// lib/i18n.ts, so client code can freely import translate/getDictionary.

import { cookies } from "next/headers";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  isLocale,
  type Locale,
} from "@/lib/i18n";

// Server-only: reads the locale cookie. Call from Server Components,
// Server Actions, or Route Handlers only.
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}