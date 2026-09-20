// lib/tenant.ts

import { getSession, type SessionPayload } from "@/lib/auth";
import { apiError } from "@/lib/api-response";

// TenantContext is exactly the session payload — no separate type that could
// drift out of sync with what auth.ts actually issues.
export type TenantContext = SessionPayload;

export class TenantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantError";
  }
}

// ── For Server Components / page-level code (app/(dashboard)/**) ──
// Throws instead of returning a response, since pages can't return
// NextResponse — this is meant to bubble up to app/(dashboard)/error.tsx (F9).
// The businessId check is a runtime safety net: SessionPayload's type says
// businessId is required, but auth.ts casts the JWT payload with
// `as unknown as SessionPayload`, so a malformed/old token isn't statically
// guaranteed to have it.
export async function getTenantContext(): Promise<TenantContext> {
  const session = await getSession();

  if (!session) {
    throw new TenantError("Not authenticated.");
  }
  if (!session.businessId) {
    throw new TenantError("Session has no associated business.");
  }

  return session;
}

// ── For API routes (app/api/**/route.ts) ──
// Mirrors the ValidationResult<T> discriminated-union pattern already used
// by parseJsonBody() in lib/validate.ts, so route handlers stay consistent:
//
//   const result = await requireTenant();
//   if (!result.success) return result.response;
//   const { tenant } = result;
//
type TenantResult =
  | { success: true; tenant: TenantContext }
  | { success: false; response: ReturnType<typeof apiError> };

export async function requireTenant(): Promise<TenantResult> {
  const session = await getSession();

  if (!session || !session.businessId) {
    return { success: false, response: apiError("Not authenticated.", 401) };
  }

  return { success: true, tenant: session };
}

// ── Query/document scoping helpers ──

// Merges businessId into a MongoDB filter so a query only ever sees rows
// belonging to the caller's own tenant.
export function scopeToTenant<T extends Record<string, unknown>>(
  tenant: TenantContext,
  filter: T = {} as T
): T & { businessId: string } {
  return { ...filter, businessId: tenant.businessId };
}

// Stamps businessId onto a new document before insertion.
export function stampTenant<T extends Record<string, unknown>>(
  tenant: TenantContext,
  doc: T
): T & { businessId: string } {
  return { ...doc, businessId: tenant.businessId };
}

// Defense-in-depth: verifies a document already fetched by its own `id`
// (not by a businessId-scoped query) actually belongs to the caller's
// tenant. Use before mutating anything fetched via findOne({ id }) alone.
export function assertOwnedByTenant(
  tenant: TenantContext,
  doc: { businessId: string } | null
): void {
  if (!doc || doc.businessId !== tenant.businessId) {
    throw new TenantError("This resource does not belong to your business.");
  }
}