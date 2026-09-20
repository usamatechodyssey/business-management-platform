// components/layout/LanguageSwitcher.tsx
//
// Client Component. Receives currentLocale + dictionary as props from a
// parent Server Component (e.g. Header.tsx in F6, which will call
// getLocale() + getDictionary() once per request) — this component itself
// never reads cookies, since that's a server-only operation.

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocale } from "@/lib/i18n-actions";
import { LOCALES, translate, type Locale, type Dictionary, type TranslationKey } from "@/lib/i18n";

interface LanguageSwitcherProps {
  currentLocale: Locale;
  dictionary: Dictionary;
}

const LOCALE_DISPLAY_LABEL: Record<Locale, string> = {
  en: "EN",
  ur: "اردو",
};

// Typed against TranslationKey (not built with a template literal) so a
// missing/renamed key in locales/*.json fails at compile time, not at runtime.
const LOCALE_ARIA_KEY: Record<Locale, TranslationKey> = {
  en: "language.en",
  ur: "language.ur",
};

export default function LanguageSwitcher({ currentLocale, dictionary }: LanguageSwitcherProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSelect(locale: Locale) {
    if (locale === currentLocale || isPending) return;

    startTransition(async () => {
      await setLocale(locale);
      // Re-runs Server Components (layout.tsx, page.tsx) with the new
      // locale cookie already set, without a full page reload.
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label={translate(dictionary, "language.switchTo")}
      className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface p-1"
    >
      {LOCALES.map((locale) => {
        const isActive = locale === currentLocale;
        return (
          <button
            key={locale}
            type="button"
            onClick={() => handleSelect(locale)}
            disabled={isPending}
            aria-pressed={isActive}
            aria-label={translate(dictionary, LOCALE_ARIA_KEY[locale])}
            className={[
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              "disabled:cursor-not-allowed disabled:opacity-60",
              isActive
                ? "bg-primary text-white"
                : "text-text-muted hover:bg-surface-muted",
            ].join(" ")}
          >
            {LOCALE_DISPLAY_LABEL[locale]}
          </button>
        );
      })}
    </div>
  );
}