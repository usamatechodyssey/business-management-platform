// lib/admin-auth.ts
//
// Authentication for platform administrators — completely separate from
// tenant user auth (lib/auth.ts). Different collection, different
// cookie name, and a derived JWT secret so a token issued for one
// purpose can never be accepted by the other even if the env var is
// shared.
//
// Impersonation model:
//   • Admin logs in at /admin/login → `admin_session_token` cookie.
//   • Admin clicks "Impersonate" on a tenant → the API endpoint issues
//     a *regular business* session (same format as lib/auth.ts uses)
//     under the standard `session_token` cookie, 30-minute expiry.
//   • The admin's own session cookie is NOT touched, so exiting
//     impersonation is a matter of clearing `session_token`.
//   • Both cookies being present simultaneously is the signal that the
//     current request is running under impersonation — the dashboard
//     layout renders a banner when it detects this.
//
// This keeps business code (lib/tenant.ts, all API routes, all Server
// Components) completely unaware of impersonation: they just see a valid
// business session, which is exactly what it is.

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import type { SessionPayload } from "@/lib/auth";
import type { AdminUser, UserRole } from "@/types";
import { apiError } from "@/lib/api-response";

export const ADMIN_SESSION_COOKIE_NAME = "admin_session_token";

const ADMIN_SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days
const IMPERSONATION_DURATION_SECONDS = 60 * 30; // 30 minutes

// Imported lazily inside the function so we can surface a distinct,
// actionable error when neither env var is set.
function getAdminJwtSecret(): Uint8Array {
  const explicit = process.env.ADMIN_JWT_SECRET;
  if (explicit) return new TextEncoder().encode(explicit);

  const base = process.env.JWT_SECRET;
  if (!base) {
    throw new Error(
      "Neither ADMIN_JWT_SECRET nor JWT_SECRET is set in environment variables."
    );
  }
  // Derive a distinct secret from the business secret. Sharing the env
  // var is convenient; sharing the *key material* would not be — the
  // suffix ensures admin tokens and user tokens are cryptographically
  // incompatible.
  return new TextEncoder().encode(`${base}:admin`);
}

export interface AdminSessionPayload {
  adminId: string;
  email: string;
  name: string;
}

// ── Password hashing ────────────────────────────────────────────

export async function hashAdminPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyAdminPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ── Session token ───────────────────────────────────────────────

export async function createAdminSessionToken(
  payload: AdminSessionPayload
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_DURATION_SECONDS}s`)
    .sign(getAdminJwtSecret());
}

export async function verifyAdminSessionToken(
  token: string
): Promise<AdminSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getAdminJwtSecret());
    return payload as unknown as AdminSessionPayload;
  } catch {
    return null;
  }
}

// ── Cookie helpers (admin session) ──────────────────────────────

export async function setAdminSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_DURATION_SECONDS,
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE_NAME);
}

export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAdminSessionToken(token);
}

// ── Impersonation ───────────────────────────────────────────────
//
// Impersonation works by setting the *business* session cookie
// (`session_token`, the same one lib/auth.ts reads). All downstream
// business code then behaves as if the tenant owner were logged in.
//
// The business session JWT is signed with the *business* JWT_SECRET,
// not the admin secret — because it will be verified by lib/auth.ts,
// which only knows the business secret.

const BUSINESS_SESSION_COOKIE = "session_token";

export async function startImpersonation(params: {
  businessId: string;
  ownerUserId: string;
  ownerName: string;
  ownerRole: UserRole;
}): Promise<void> {
  const businessSecret = process.env.JWT_SECRET;
  if (!businessSecret) {
    throw new Error("JWT_SECRET is not set in environment variables.");
  }

  const payload: SessionPayload = {
    userId: params.ownerUserId,
    businessId: params.businessId,
    role: params.ownerRole,
    name: params.ownerName,
  };

  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${IMPERSONATION_DURATION_SECONDS}s`)
    .sign(new TextEncoder().encode(businessSecret));

  const cookieStore = await cookies();
  cookieStore.set(BUSINESS_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: IMPERSONATION_DURATION_SECONDS,
  });
  // Marker cookie so the business dashboard can render a banner.
  cookieStore.set(ADMIN_IMPERSONATING_COOKIE_NAME, params.businessId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: IMPERSONATION_DURATION_SECONDS,
  });
}

export async function stopImpersonation(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(BUSINESS_SESSION_COOKIE);
  cookieStore.delete(ADMIN_IMPERSONATING_COOKIE_NAME);
}

// ── Convenience: toSafeAdmin ────────────────────────────────────

export type SafeAdmin = Omit<AdminUser, "passwordHash">;

export function toSafeAdmin(admin: AdminUser): SafeAdmin {
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    active: admin.active,
    createdAt: admin.createdAt,
    lastLogin: admin.lastLogin,
  };
}

// ── Admin route guard ───────────────────────────────────────────
//
// Same discriminated-union pattern as requireTenant() in lib/tenant.ts,
// so admin API routes stay consistent with the rest of the codebase.

type AdminResult =
  | { success: true; admin: AdminSessionPayload }
  | { success: false; response: ReturnType<typeof apiError> };

export async function requireAdmin(): Promise<AdminResult> {
  const session = await getAdminSession();
  if (!session) {
    return { success: false, response: apiError("Not authenticated.", 401) };
  }
  return { success: true, admin: session };
} 

// ── Impersonation marker cookie ─────────────────────────────────
//
// Set alongside the business session cookie during impersonation. Its
// presence is the signal that the current business session was created
// by an admin, not by the owner logging in normally. The business
// dashboard reads this to render a banner; exit-impersonation clears it
// along with the session cookie.
//
// Named distinctly from the admin session cookie so the two never get
// confused in code that checks "is the admin logged in?".

export const ADMIN_IMPERSONATING_COOKIE_NAME = "admin_impersonating";

export async function setImpersonationMarker(businessId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_IMPERSONATING_COOKIE_NAME, businessId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Keep this aligned with the impersonation session's expiry (30 min).
    maxAge: IMPERSONATION_DURATION_SECONDS,
  });
}

export async function clearImpersonationMarker(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_IMPERSONATING_COOKIE_NAME);
}

export async function getImpersonationMarker(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_IMPERSONATING_COOKIE_NAME)?.value ?? null;
}