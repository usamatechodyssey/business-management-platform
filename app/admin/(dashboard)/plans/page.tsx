// app/admin/(dashboard)/plans/page.tsx
//
// Admin plans management. Lists every plan tier (active + inactive),
// with create / edit / delete actions.

import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { listAllPlans } from "@/lib/plans";
import { AdminPlansClient } from "./AdminPlansClient";

export default async function AdminPlansPage() {
  const locale = await getLocale();
  const dictionary = getDictionary(locale);
  const plans = await listAllPlans();

  return <AdminPlansClient plans={plans} dictionary={dictionary} />;
}