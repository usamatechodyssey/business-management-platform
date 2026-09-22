// app/api/admin/settings/route.ts
//
// GET  — read current platform settings
// PATCH — update platform settings
//
// All admin-authenticated. Only the fields listed in updatePlatformSettings
// can be modified.

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/validate";
import { requireAdmin } from "@/lib/admin-auth";
import {
  getPlatformSettings,
  updatePlatformSettings,
} from "@/lib/platform-settings";
import { writeAdminAction } from "@/lib/admin-db";

const emptyToNull = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

const updateSchema = z.object({
  trialEnabled: z.boolean().optional(),
  trialDays: z.number().int().min(1).max(90).optional(),
  trialWarningDays: z.number().int().min(0).max(30).optional(),
  supportWhatsApp: z.string().trim().max(30).optional(),
  supportEmail: z
    .preprocess(
      (v) => {
        if (typeof v !== "string") return v;
        const t = v.trim();
        return t === "" ? undefined : t;
      },
      z.string().email().max(254).optional()
    )
    .optional(),
  blockedTitleOverride: z.preprocess(
    emptyToNull,
    z.string().max(120).nullable().optional()
  ),
  blockedDescriptionOverride: z.preprocess(
    emptyToNull,
    z.string().max(500).nullable().optional()
  ),
  bulkReminderTemplate: z.string().trim().min(1).max(500).optional(),
});

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.success) return guard.response;

  const settings = await getPlatformSettings();
  return apiSuccess(settings);
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.success) return guard.response;
  const { admin } = guard;

  const parsed = await parseJsonBody(req, updateSchema);
  if (!parsed.success) return parsed.response;

  if (Object.keys(parsed.data).length === 0) {
    return apiSuccess(await getPlatformSettings());
  }

  const updated = await updatePlatformSettings({
    ...parsed.data,
    adminId: admin.adminId,
  });

  await writeAdminAction({
    adminId: admin.adminId,
    adminName: admin.name,
    type: "platform.settings.update",
    metadata: {
      fields: Object.keys(parsed.data).join(", "),
    },
  });

  return apiSuccess(updated);
}