// app/admin/(dashboard)/settings/page.tsx
//
// Platform-wide configuration. Reads the singleton settings document
// and hands it to the client wrapper for editing.

import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { getPlatformSettings } from "@/lib/platform-settings";
import { AdminSettingsClient } from "./AdminSettingsClient";

export default async function AdminSettingsPage() {
  const locale = await getLocale();
  const dictionary = getDictionary(locale);
  const settings = await getPlatformSettings();

  return (
    <AdminSettingsClient settings={settings} dictionary={dictionary} />
  );
}