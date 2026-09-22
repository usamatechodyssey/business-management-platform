// lib/pricing.ts
//
// Only the duration options live here now — prices come from the
// admin-managed planTiers collection (see lib/plans.ts). Keeping month
// options as a fixed constant matches how most SaaS products operate
// (you don't usually let admins create arbitrary durations).

export const MONTH_OPTIONS = [1, 3, 6, 12] as const;

export type MonthOption = (typeof MONTH_OPTIONS)[number];

// Computes the total for a chosen plan + duration. Takes the plan's
// priceMonthly as input rather than a slug, since the caller always has
// the full plan object on hand.
export function calculateAmount(
  priceMonthly: number,
  months: number
): number {
  return priceMonthly * months;
}