// app/api/auth/session-invalid/route.ts

import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function GET(req: NextRequest) {
  await clearSessionCookie();
  const loginUrl = new URL("/login", req.nextUrl.origin);
  return NextResponse.redirect(loginUrl);
}