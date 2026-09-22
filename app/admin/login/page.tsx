// app/admin/login/page.tsx

import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { AdminLoginForm } from "./AdminLoginForm";

export default async function AdminLoginPage() {
  const locale = await getLocale();
  const dictionary = getDictionary(locale);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-sm">
        <AdminLoginForm dictionary={dictionary} />
      </div>
    </div>
  );
}