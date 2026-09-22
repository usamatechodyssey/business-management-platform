// lib/platform-info.ts
//
// Reads platform operator payment details from environment variables.
// These are shown to business owners on the billing page so they know
// where to send money. Kept server-only — the values are read in
// Server Components and passed to client components as props.
//
// Empty values are skipped in the UI — if you don't have a bank account
// configured, the bank row simply won't render.

export interface PlatformPaymentInfo {
  displayName: string;
  jazzcash: string | null;
  easypaisa: string | null;
  bank: string | null;
}

export function getPlatformPaymentInfo(): PlatformPaymentInfo {
  const jazzcash = process.env.PLATFORM_JAZZCASH_NUMBER?.trim() || null;
  const easypaisa = process.env.PLATFORM_EASYPAISA_NUMBER?.trim() || null;
  const bank = process.env.PLATFORM_BANK_DETAILS?.trim() || null;
  const displayName = process.env.PLATFORM_DISPLAY_NAME?.trim() || "Support";

  return { displayName, jazzcash, easypaisa, bank };
}

// True when at least one payment channel is configured. Used by the
// billing page to decide whether the "renew" flow is even possible.
export function hasAnyPaymentChannel(info: PlatformPaymentInfo): boolean {
  return !!(info.jazzcash || info.easypaisa || info.bank);
}