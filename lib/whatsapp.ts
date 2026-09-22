// lib/whatsapp.ts
//
// WhatsApp deep-link helpers. The whole integration is a wa.me URL with
// a prefilled message — zero cost, no Meta Business API approval, works
// on mobile + desktop (opens WhatsApp Web). The user always taps Send
// in WhatsApp itself; nothing here sends messages on its own.
//
// Used by:
//   - app/api/businesses/route.ts (default template bootstrap)
//   - components/whatsapp/ReminderModal.tsx (URL builder + preview)
//   - Future modules that want to prefill a message (receipts, etc.)

// ── Default templates ───────────────────────────────────────────
//
// Shipped with the business bootstrap so a fresh tenant has a working
// reminder out of the box. Owners override these in Settings (M11).
// Kept here (not in a settings module) because they're intrinsically
// WhatsApp-shaped and share the placeholder vocabulary.

export const DEFAULT_REMINDER_TEMPLATE_ENGLISH =
  "Assalam-o-Alaikum {{customerName}}, your outstanding balance at {{businessName}} is Rs. {{amount}}. Please clear it at your convenience. JazakAllah.";

export const DEFAULT_REMINDER_TEMPLATE_URDU =
  "السلام علیکم {{customerName}}، {{businessName}} پر آپ کا واجب الادا Rs. {{amount}} ہے۔ براہ کرم سہولت کے مطابق ادائیگی کر دیں۔ جزاک اللہ۔";

// All placeholders supported by both default templates and any custom
// template the owner writes in Settings. Unknown placeholders are
// replaced with an empty string rather than throwing.
export const REMINDER_PLACEHOLDERS = [
  "customerName",
  "businessName",
  "amount",
  "phone",
] as const;

export type ReminderPlaceholder = (typeof REMINDER_PLACEHOLDERS)[number];

// ── Phone normalization ─────────────────────────────────────────

// Converts a user-entered Pakistani phone into the digits-only form
// wa.me expects (country code + number, no "+", no leading zero).
//
// Accepted inputs:
//   03001234567        → 923001234567
//   +923001234567      → 923001234567
//   923001234567       → 923001234567
//   3001234567         → 923001234567  (assumes 3xx = mobile)
//   02134567890        → 922134567890  (landline, best-effort)
//
// Returns null when the input doesn't look like a valid Pakistani
// number (wrong length after normalization, or empty).
export function normalizePhoneForWhatsApp(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return null;

  let withCountry: string;

  if (digits.startsWith("92")) {
    // Already has the country code.
    withCountry = digits;
  } else if (digits.startsWith("0")) {
    // Local format — drop the trunk zero and prepend 92.
    withCountry = `92${digits.slice(1)}`;
  } else if (digits.length === 10) {
    // Bare mobile number without trunk zero (3xxxxxxxxx).
    withCountry = `92${digits}`;
  } else {
    // Unknown shape — refuse rather than guess.
    return null;
  }

  // Pakistani numbers in international form are 12 digits (92 + 10).
  // Anything outside that window is almost certainly a typo.
  if (withCountry.length < 11 || withCountry.length > 13) {
    return null;
  }

  return withCountry;
}

// ── Template rendering ──────────────────────────────────────────

// Replaces each {{placeholder}} with its value. Missing placeholders
// become empty strings — a reminder with a slightly sparse sentence is
// better than a crash, and the caller can always inspect the preview.
export function renderTemplate(
  template: string,
  values: Partial<Record<ReminderPlaceholder, string>>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = values[key as ReminderPlaceholder];
    return value ?? "";
  });
}

// ── Deep link ───────────────────────────────────────────────────

// Builds a wa.me link. Returns null when the phone couldn't be
// normalized so the caller can show "invalid phone number" instead of
// generating a broken link that opens a random chat.
export function buildWhatsAppUrl(
  rawPhone: string,
  message: string
): string | null {
  const phone = normalizePhoneForWhatsApp(rawPhone);
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}