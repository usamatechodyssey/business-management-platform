// lib/trial.ts
//
// Pure helpers for trial subscription lifecycle. Called at register
// time (to seed the initial trial) and at dashboard render time (to
// check whether the subscription has lapsed).

import type { BusinessSubscription, SubscriptionStatus } from "@/types";

// Adds `days` calendar days to a base date. Returns ISO string.
function addDays(base: Date, days: number): string {
  const result = new Date(base);
  result.setDate(result.getDate() + days);
  return result.toISOString();
}

// Builds a trial subscription that starts now and runs for `trialDays`
// calendar days.
export function buildTrialSubscription(trialDays: number): BusinessSubscription {
  const now = new Date();
  return {
    status: "trial",
    plan: "trial",
    startedAt: now.toISOString(),
    expiresAt: addDays(now, trialDays),
  };
}

// Whole days remaining until expiry. Negative when already past.
// Rounded up so "0.5 days left" reads as "1 day left".
export function daysUntilExpiry(expiresAt: string): number {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

// A subscription is considered "lapsed" when its status is expired or
// suspended, OR when the expiry date has passed regardless of status.
// The date check catches the case where the status field is stale but
// the date has clearly moved on.
export function isSubscriptionLapsed(
  subscription: BusinessSubscription | undefined
): boolean {
  if (!subscription) {
    // No subscription record at all → treat as lapsed. Legacy data
    // (pre-trial) doesn't exist in this build.
    return true;
  }
  if (subscription.status === "expired") return true;
  if (subscription.status === "suspended") return true;
  if (new Date(subscription.expiresAt).getTime() < Date.now()) return true;
  return false;
}

// Reason code for the blocked screen — separates "user was manually
// suspended" from "trial just ran out" so the copy reads correctly.
export function lapseReason(
  subscription: BusinessSubscription | undefined
): "suspended" | "expired" {
  if (subscription?.status === "suspended") return "suspended";
  return "expired";
}

// Statuses that should render a warning banner before they lapse.
export function shouldWarnAboutExpiry(
  subscription: BusinessSubscription | undefined,
  warningDays: number
): boolean {
  if (!subscription) return false;
  if (subscription.status !== "trial" && subscription.status !== "active") {
    return false;
  }
  const days = daysUntilExpiry(subscription.expiresAt);
  return days >= 0 && days <= warningDays;
}

// Narrow helper — exposes the type to callers that only need it here.
export type { SubscriptionStatus };