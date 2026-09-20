// lib/i18n.ts
//
// Pure i18n primitives — dictionary loading, direction, typed keys, and the
// translate() function. Safe to import from BOTH Server and Client
// Components. Nothing here touches next/headers; that lives in
// lib/i18n-server.ts so this module never poisons a client bundle.

import en from "@/locales/en.json";
import ur from "@/locales/ur.json";

export type Locale = "en" | "ur";
export const LOCALES: Locale[] = ["en", "ur"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE_NAME = "locale";

// `en.json` is the source of truth for the dictionary shape. TypeScript's
// structural typing means if `ur.json` is missing a key (or has an extra
// one under a different name), the `dictionaries` object literal below
// fails to compile — translations can never silently go missing.
export type Dictionary = typeof en;

const dictionaries: Record<Locale, Dictionary> = { en, ur };

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as string[]).includes(value);
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export function getDirection(locale: Locale): "ltr" | "rtl" {
  return locale === "ur" ? "rtl" : "ltr";
}

// ── Typed translation keys ──────────────────────────────────────────
// Recursively builds a union of every dot-path leaf key in the dictionary
// (e.g. "common.save" | "auth.loginTitle" | ...), so translate() rejects
// typos or keys that don't exist at compile time — no magic strings.
type DotPaths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends Record<string, unknown>
      ? DotPaths<T[K], `${Prefix}${K}.`>
      : never;
}[keyof T & string];

export type TranslationKey = DotPaths<Dictionary>;

export function translate(
  dictionary: Dictionary,
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  const value = key.split(".").reduce<unknown>((node, segment) => {
    if (node && typeof node === "object" && segment in node) {
      return (node as Record<string, unknown>)[segment];
    }
    return undefined;
  }, dictionary);

  if (typeof value !== "string") {
    if (process.env.NODE_ENV !== "production") {
      throw new Error(`Missing translation for key: "${key}"`);
    }
    return key;
  }

  if (!params) return value;

  return Object.entries(params).reduce(
    (result, [paramKey, paramValue]) => result.replaceAll(`{{${paramKey}}}`, String(paramValue)),
    value
  );
}