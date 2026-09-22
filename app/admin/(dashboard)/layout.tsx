// app/admin/(dashboard)/layout.tsx

import type { ReactNode } from "react";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { getAdminSession } from "@/lib/admin-auth";
import { countPendingPayments } from "@/lib/payments";
import { AdminHeader } from "./AdminHeader";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const locale = await getLocale();
  const dictionary = getDictionary(locale);
  const admin = await getAdminSession();
  const pendingPayments = await countPendingPayments();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AdminHeader
        adminName={admin?.name ?? "Admin"}
        pendingPayments={pendingPayments}
        dictionary={dictionary}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
}