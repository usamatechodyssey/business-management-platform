// app/(dashboard)/loading.tsx
//
// Route-level loading fallback. Server Component — getLocale() is safe here.
// Rendered inside the layout's {children} slot, so DashboardShell chrome
// stays visible while a page's data resolves.

import { getDictionary, translate } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { Loader } from "@/app/components/ui/Loader";

export default async function DashboardLoading() {
  const locale = await getLocale();
  const dictionary = getDictionary(locale);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Loader size="lg" label={translate(dictionary, "common.loading")} />
    </div>
  );
}