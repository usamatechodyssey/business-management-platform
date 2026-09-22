// app/(dashboard)/billing/plans/page.tsx
//
// Customer-facing plan comparison page. Shows every active purchasable
// plan side-by-side with its features and limits.

import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { listActivePlans } from "@/lib/plans";
import { PlansComparison } from "./PlansComparison";

export default async function BillingPlansPage() {
  const locale = await getLocale();
  const dictionary = getDictionary(locale);

  const all = await listActivePlans();
  const plans = all.filter((p) => !p.isTrialPlan);

  return (
    <PlansComparison
      plans={plans}
      locale={locale}
      dictionary={dictionary}
    />
  );
}