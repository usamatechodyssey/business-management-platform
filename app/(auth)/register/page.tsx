// app/(auth)/register/page.tsx
//
// Server Component. Same shape as login/page.tsx — resolve locale +
// dictionary, hand them to the client RegisterForm. The already-authenticated
// redirect is handled by proxy.ts.

import { translate, getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage() {
  const locale = await getLocale();
  const dictionary = getDictionary(locale);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-foreground">
        {translate(dictionary, "auth.registerTitle")}
      </h2>
      <RegisterForm dictionary={dictionary} />
    </div>
  );
}