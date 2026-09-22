// proxy.ts
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const BUSINESS_SESSION_COOKIE = "session_token";
const ADMIN_SESSION_COOKIE = "admin_session_token";

const PUBLIC_PATHS = ["/login", "/register"];
const ADMIN_PUBLIC_PATHS = ["/admin/login"];

async function isBusinessSessionValid(
  token: string | undefined
): Promise<boolean> {
  if (!token) return false;
  const secret = process.env.JWT_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

async function isAdminSessionValid(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const secret =
    process.env.ADMIN_JWT_SECRET ??
    (process.env.JWT_SECRET ? `${process.env.JWT_SECRET}:admin` : undefined);
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin")) {
    const isPublic = ADMIN_PUBLIC_PATHS.some((p) => pathname.startsWith(p));
    const adminToken = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const adminAuthed = await isAdminSessionValid(adminToken);

    if (!isPublic && !adminAuthed) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
    if (isPublic && adminAuthed) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    return NextResponse.next();
  }

  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const token = req.cookies.get(BUSINESS_SESSION_COOKIE)?.value;
  const authenticated = await isBusinessSessionValid(token);

  if (!isPublicPath && !authenticated) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (isPublicPath && authenticated) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};