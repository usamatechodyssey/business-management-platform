import { NextResponse } from "next/server";

type ApiSuccess<T> = { success: true; data: T };
type ApiError = {
  success: false;
  error: { message: string; code?: string; fields?: Record<string, string> };
};

export function apiSuccess<T>(data: T, status = 200) {
  const body: ApiSuccess<T> = { success: true, data };
  return NextResponse.json(body, { status });
}

export function apiError(
  message: string,
  status = 400,
  options?: { code?: string; fields?: Record<string, string> }
) {
  const body: ApiError = {
    success: false,
    error: { message, code: options?.code, fields: options?.fields },
  };
  return NextResponse.json(body, { status });
}