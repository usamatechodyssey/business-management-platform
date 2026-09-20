import { NextRequest } from "next/server";
import { ZodSchema, ZodError } from "zod";
import { apiError } from "./api-response";

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; response: ReturnType<typeof apiError> };

export async function parseJsonBody<T>(
  req: NextRequest,
  schema: ZodSchema<T>
): Promise<ValidationResult<T>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return { success: false, response: apiError("Request body must be valid JSON.", 400) };
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    return {
      success: false,
      response: apiError("Validation failed.", 422, { fields: flattenZodError(result.error) }),
    };
  }

  return { success: true, data: result.data };
}

function flattenZodError(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_root";
    if (!fields[path]) fields[path] = issue.message;
  }
  return fields;
}