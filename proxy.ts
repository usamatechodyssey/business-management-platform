// proxy.ts
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "session_token";
const PUBLIC_PATHS = ["/login", "/register"];

async function isValidSession(token: string | undefined): Promise<boolean> {
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

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const authenticated = await isValidSession(token);

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