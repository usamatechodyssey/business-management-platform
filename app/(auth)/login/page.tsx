// app/(auth)/login/page.tsx
//
// Server Component. Only job: resolve locale + dictionary, render the
// client LoginForm with them as props. The already-authenticated redirect
// (logged-in user hitting /login) is handled by proxy.ts — no duplicate
// check here.

import { translate, getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const locale = await getLocale();
  const dictionary = getDictionary(locale);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-foreground">
        {translate(dictionary, "auth.loginTitle")}
      </h2>
      <LoginForm dictionary={dictionary} />
    </div>
  );
}