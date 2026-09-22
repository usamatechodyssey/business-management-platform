// app/admin/(dashboard)/actions/page.tsx
//
// Full audit trail of every admin action — logins, tenant suspensions,
// grants, impersonations, etc. Server component that fetches the first
// page and hands it to the client for rendering (and pagination).

import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { listAdminActions } from "@/lib/admin-db";
import { AdminActionsClient } from "./AdminActionsClient";

interface AdminActionsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function readString(value: string | string[] | undefined): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

export default async function AdminActionsPage({
  searchParams,
}: AdminActionsPageProps) {
  const params = await searchParams;
  const locale = await getLocale();
  const dictionary = getDictionary(locale);

  const pageParam = Number(readString(params.page));
  const page =
    Number.isFinite(pageParam) && pageParam >= 1 ? Math.floor(pageParam) : 1;

  const result = await listAdminActions(page);

  return (
    <AdminActionsClient
      actions={result.actions}
      pagination={{
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      }}
      locale={locale}
      dictionary={dictionary}
    />
  );
}