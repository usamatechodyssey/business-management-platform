// app/api/settings/route.ts
//
// GET  — read the current business (settings owner-only; requires
//        "settings.manage"). Kept read-only here because the profile
//        fields are already exposed via /api/businesses/[id].
// PATCH — update enabledModules and the settings sub-document
//        (requires "settings.manage").
//
// Field-level validation lives client-side (SettingsClient tabs) with the
// user's locale; the server-side Zod schema is a security backstop.

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/validate";
import { requireTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { getBusinessById, updateSettings } from "@/lib/settings";

const moduleKeySchema = z.enum([
  "pos",
  "inventory",
  "suppliers",
  "customers",
  "reports",
  "profitFund",
  "staff",
]);

const khataSettingsSchema = z.object({
  creditLimitEnabled: z.boolean(),
  defaultCreditLimit: z.number().min(0),
  blockSaleOnLimitExceeded: z.boolean(),
  dueDateTrackingEnabled: z.boolean(),
  defaultPaymentTermsDays: z.number().int().min(0),
  guarantorEnabled: z.boolean(),
  customerTagsEnabled: z.boolean(),
  allowPartialPayments: z.boolean(),
  requireCustomerPhoneForCredit: z.boolean(),
  // Empty strings are valid — the reminder modal falls back to built-in
  // defaults when a template is blank.
  reminderTemplateUrdu: z.string().max(500),
  reminderTemplateEnglish: z.string().max(500),
  defaultReminderLanguage: z.enum(["ur", "en"]),
});

// Every field is optional so a caller can update just one (e.g. the
// language toggle on the settings page). Omitted fields are preserved.
const settingsSchema = z
  .object({
    lowStockThreshold: z.number().int().min(0).optional(),
    language: z.enum(["en", "ur"]).optional(),
    khataSettings: khataSettingsSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one settings field must be provided.",
  });

const updateSettingsSchema = z.object({
  enabledModules: z.array(moduleKeySchema).optional(),
  settings: settingsSchema.optional(),
});

export async function GET() {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "settings.manage")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const business = await getBusinessById(tenant.businessId);
  if (!business) return apiError("Business not found.", 404);

  return apiSuccess(business);
}

export async function PATCH(req: NextRequest) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "settings.manage")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const parsed = await parseJsonBody(req, updateSettingsSchema);
  if (!parsed.success) return parsed.response;

  const { enabledModules, settings } = parsed.data;

  if (enabledModules === undefined && settings === undefined) {
    return apiError("No fields to update.", 400);
  }

  const updated = await updateSettings(tenant.businessId, {
    enabledModules,
    settings,
  });
  if (!updated) {
    return apiError("Business not found.", 404);
  }

  return apiSuccess(updated);
}