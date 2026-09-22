// lib/settings.ts
//
// Server-only settings update logic. The profile fields (name, ownerName,
// phone, address) are already handled by /api/businesses/[id] — this
// module covers enabledModules + the settings sub-document (khata
// settings, language, low stock threshold).
//
// Currency is deliberately not part of the update payload — it's locked
// to "PKR" per the project's currency decision, and the DB write
// preserves whatever's stored rather than accepting client input.

import { getDb } from "@/lib/db";
import type { Business, BusinessSettings, ModuleKey } from "@/types";

export const ALL_MODULE_KEYS: readonly ModuleKey[] = [
  "pos",
  "inventory",
  "suppliers",
  "customers",
  "reports",
  "profitFund",
  "staff",
] as const;

export type WritableSettings = Partial<Omit<BusinessSettings, "currency">>;

export async function getBusinessById(
  businessId: string
): Promise<Business | null> {
  const db = await getDb();
  return db.collection<Business>("businesses").findOne({ id: businessId });
}

export interface UpdateSettingsInput {
  enabledModules?: ModuleKey[];
  settings?: WritableSettings;
}

// Writes only the fields the caller actually sent. Disabled modules are
// left in the document only if they're toggled off; a module removed from
// `enabledModules` is not deleted anywhere else — no data loss, the
// nav just hides the corresponding routes.
export async function updateSettings(
  businessId: string,
  input: UpdateSettingsInput
): Promise<Business | null> {
  const db = await getDb();

  const setFields: Record<string, unknown> = {};

  if (input.enabledModules !== undefined) {
    setFields.enabledModules = input.enabledModules;
  }

  if (input.settings !== undefined) {
    // Only write keys the caller actually sent so unrelated settings
    // (e.g. khata sub-doc when only the language is changing) survive.
    if (input.settings.lowStockThreshold !== undefined) {
      setFields["settings.lowStockThreshold"] =
        input.settings.lowStockThreshold;
    }
    if (input.settings.language !== undefined) {
      setFields["settings.language"] = input.settings.language;
    }
    if (input.settings.khataSettings !== undefined) {
      setFields["settings.khataSettings"] = input.settings.khataSettings;
    }
  }

  if (Object.keys(setFields).length === 0) return null;

  return db
    .collection<Business>("businesses")
    .findOneAndUpdate(
      { id: businessId },
      { $set: setFields },
      { returnDocument: "after" }
    );
}