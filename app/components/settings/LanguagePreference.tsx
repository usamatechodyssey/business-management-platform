// app/components/settings/LanguagePreference.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useToast } from "@/app/components/ui/Toast";
import { setLocale } from "@/lib/i18n-actions";
import { translate, type Dictionary, type Locale } from "@/lib/i18n";

interface LanguagePreferenceProps {
  currentLocale: Locale;
  businessLanguage: Locale;
  dictionary: Dictionary;
}

export function LanguagePreference({
  currentLocale,
  businessLanguage,
  dictionary,
}: LanguagePreferenceProps) {
  const router = useRouter();
  const { push } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);

  const currentSelection = currentLocale;

  function handleSelect(next: Locale) {
    if (next === currentSelection || isPending || isSaving) return;

    startTransition(async () => {
      // Two writes:
      //   1. Cookie via setLocale — takes effect immediately for this
      //      device (same mechanism as the header switcher).
      //   2. Business.settings.language via /api/settings — records the
      //      business's preferred default for new staff accounts.
      // Both run before router.refresh() so the server tree renders with
      // the new locale on the next paint.
      try {
        setIsSaving(true);
        await setLocale(next);

        // Only `language` is sent — /api/settings PATCH merges partial
        // settings so no other field is touched. That's why we don't
        // need to send the full settings sub-document here.
        const response = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings: { language: next } }),
        });

        if (!response.ok) {
          push({
            message: translate(dictionary, "errors.generic"),
            variant: "error",
          });
        } else {
          push({
            message: translate(dictionary, "settings.saved"),
            variant: "success",
          });
        }

        router.refresh();
      } finally {
        setIsSaving(false);
      }
    });
  }

  const options: {
    value: Locale;
    labelKey:
      | "settings.language.english"
      | "settings.language.urdu";
  }[] = [
    { value: "en", labelKey: "settings.language.english" },
    { value: "ur", labelKey: "settings.language.urdu" },
  ];

  const isBusy = isPending || isSaving;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <div>
          <p className="text-sm text-text-muted">
            {translate(dictionary, "settings.language.currentLabel")}:{" "}
            <span className="font-medium text-foreground">
              {translate(
                dictionary,
                currentSelection === "en"
                  ? "settings.language.english"
                  : "settings.language.urdu"
              )}
            </span>
          </p>
          {businessLanguage !== currentSelection && (
            <p className="mt-1 text-xs text-text-muted">
              {translate(
                dictionary,
                "settings.language.businessDefaultDiffers"
              )}
            </p>
          )}
        </div>

        <div
          role="radiogroup"
          aria-label={translate(dictionary, "settings.language.heading")}
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
          {options.map(({ value, labelKey }) => {
            const isActive = currentSelection === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => handleSelect(value)}
                disabled={isBusy}
                className={[
                  "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-start transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                  isActive
                    ? "border-primary bg-primary/5"
                    : "border-border bg-surface hover:bg-surface-muted",
                ].join(" ")}
              >
                <span className="text-sm font-medium text-foreground">
                  {translate(dictionary, labelKey)}
                </span>
                {isActive && (
                  <Check
                    className="h-4 w-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-text-muted">
          {translate(dictionary, "settings.language.helper")}
        </p>
      </div>
    </div>
  );
}