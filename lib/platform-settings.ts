// lib/platform-settings.ts
//
// Server-only singleton accessor for platform-wide configuration. The
// document is seeded with sensible defaults on first read — no manual
// setup step required. Only one document ever exists (id="singleton").

import { getDb } from "@/lib/db";
import type { PlatformSettings } from "@/types";

const SINGLETON_ID = "singleton";

// Defaults applied when the document doesn't exist yet. Once the admin
// saves changes, these are never reapplied — the DB is authoritative.
function buildDefaults(): Omit<PlatformSettings, "updatedAt"> {
  return {
    id: SINGLETON_ID,
    trialEnabled: true,
    trialDays: 3,
    trialWarningDays: 2,
    supportWhatsApp: process.env.PLATFORM_WHATSAPP_NUMBER ?? "",
    supportEmail: "",
    blockedTitleOverride: null,
    blockedDescriptionOverride: null,
    bulkReminderTemplate:
      "Assalam-o-Alaikum {ownerName}, your {businessName} trial ends on {expiryDate}. Renew here: {renewalUrl}",
  };
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const db = await getDb();
  const collection = db.collection<PlatformSettings>("platformSettings");

  const existing = await collection.findOne({ id: SINGLETON_ID });
  if (existing) return existing;

  // Seed on first read. `$setOnInsert` keeps concurrent readers from
  // racing — only one insert wins, the rest fall through to findOne.
  const defaults = buildDefaults();
  const now = new Date().toISOString();

  const seeded = await collection.findOneAndUpdate(
    { id: SINGLETON_ID },
    {
      $setOnInsert: {
        ...defaults,
        updatedAt: now,
      },
    },
    { upsert: true, returnDocument: "after" }
  );

  // findOneAndUpdate with upsert always returns a document (existing or
  // newly inserted) — the null branch is defensive only.
  return seeded ?? { ...defaults, updatedAt: now };
}

export interface UpdatePlatformSettingsInput {
  trialEnabled?: boolean;
  trialDays?: number;
  trialWarningDays?: number;
  supportWhatsApp?: string;
  supportEmail?: string;
  blockedTitleOverride?: string | null;
  blockedDescriptionOverride?: string | null;
  bulkReminderTemplate?: string;
  adminId: string;
}

export async function updatePlatformSettings(
  input: UpdatePlatformSettingsInput
): Promise<PlatformSettings> {
  const { adminId, ...updates } = input;

  const db = await getDb();
  const collection = db.collection<PlatformSettings>("platformSettings");

  const setFields: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
    updatedBy: adminId,
  };

  if (updates.trialEnabled !== undefined) setFields.trialEnabled = updates.trialEnabled;
  if (updates.trialDays !== undefined) setFields.trialDays = updates.trialDays;
  if (updates.trialWarningDays !== undefined) setFields.trialWarningDays = updates.trialWarningDays;
  if (updates.supportWhatsApp !== undefined) setFields.supportWhatsApp = updates.supportWhatsApp;
  if (updates.supportEmail !== undefined) setFields.supportEmail = updates.supportEmail;
  if (updates.blockedTitleOverride !== undefined) {
    setFields.blockedTitleOverride = updates.blockedTitleOverride;
  }
  if (updates.blockedDescriptionOverride !== undefined) {
    setFields.blockedDescriptionOverride = updates.blockedDescriptionOverride;
  }
  if (updates.bulkReminderTemplate !== undefined) {
    setFields.bulkReminderTemplate = updates.bulkReminderTemplate;
  }

  const result = await collection.findOneAndUpdate(
    { id: SINGLETON_ID },
    {
      $set: setFields,
      $setOnInsert: { id: SINGLETON_ID },
    },
    { upsert: true, returnDocument: "after" }
  );

  if (!result) {
    throw new Error("Failed to update platform settings.");
  }
  return result;
}