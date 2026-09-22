// components/layout/LocaleProvider.tsx
"use client";

import { createContext, useContext, type ReactNode } from "react";
import { installApiFetchInterceptor } from "@/lib/api-fetch";
import type { Dictionary, Locale } from "@/lib/i18n";

// Install the global 401 interceptor once, at module import time.
// LocaleProvider is mounted at the root layout and loaded on every
// page, so this is the earliest safe client-side hook in the app.
// Idempotent — safe across HMR reloads and repeated imports.
installApiFetchInterceptor();

interface LocaleContextValue {
  locale: Locale;
  dictionary: Dictionary;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

interface LocaleProviderProps extends LocaleContextValue {
  children: ReactNode;
}

// Mounted once, at the root layout, with the request's resolved locale +
// dictionary. Client components (notably Next.js error.tsx, which receives
// no custom props from its parent) read via useLocale() instead of threading
// locale props through every intermediate component.
export function LocaleProvider({
  locale,
  dictionary,
  children,
}: LocaleProviderProps) {
  return (
    <LocaleContext.Provider value={{ locale, dictionary }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale() must be used inside a <LocaleProvider>.");
  }
  return context;
}