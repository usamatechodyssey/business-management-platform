// lib/subscription-guard.ts
//
// API-route guard that combines the standard tenant check with a
// subscription-lapsed check. Mutating routes call requireActiveTenant()
// instead of requireTenant() — reads stay accessible so the billing
// page can still function for a lapsed tenant.

import { getDb } from "@/lib/db";
import { apiError } from "@/lib/api-response";
import { requireTenant } from "@/lib/tenant";
import { isSubscriptionLapsed } from "@/lib/trial";
import type { Business } from "@/types";

type ActiveTenantResult =
  | {
      success: true;
      tenant: { userId: string; businessId: string; role: import("@/types").UserRole; name: string };
    }
  | { success: false; response: ReturnType<typeof apiError> };

export async function requireActiveTenant(): Promise<ActiveTenantResult> {
  const base = await requireTenant();
  if (!base.success) return base;

  const db = await getDb();
  const business = await db
    .collection<Business>("businesses")
    .findOne(
      { id: base.tenant.businessId },
      { projection: { subscription: 1 } }
    );

  if (isSubscriptionLapsed(business?.subscription)) {
    return {
      success: false,
      response: apiError(
        "Your subscription has lapsed. Please renew to continue.",
        403,
        { code: "SUBSCRIPTION_LAPSED" }
      ),
    };
  }

  return { success: true, tenant: base.tenant };
}