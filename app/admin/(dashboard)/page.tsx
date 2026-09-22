// app/admin/(dashboard)/page.tsx

import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { listTenants } from "@/lib/admin-db";
import { getPlatformSettings } from "@/lib/platform-settings";
import { AdminTenantsClient } from "./AdminTenantsClient";

interface AdminPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function readString(value: string | string[] | undefined): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

const VALID_STATUSES = ["all", "trial", "active", "expired", "suspended"] as const;
type StatusFilter = (typeof VALID_STATUSES)[number];

const VALID_SIGNUP_WINDOWS = ["all", "today", "week", "month", "year"] as const;
type SignupWindow = (typeof VALID_SIGNUP_WINDOWS)[number];

export default async function AdminHomePage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const locale = await getLocale();
  const dictionary = getDictionary(locale);
  const platform = await getPlatformSettings();

  const q = readString(params.q).trim();

  const rawStatus = readString(params.status);
  const status: StatusFilter = (VALID_STATUSES as readonly string[]).includes(rawStatus)
    ? (rawStatus as StatusFilter)
    : "all";

  const rawSignup = readString(params.signup);
  const signupWindow: SignupWindow = (VALID_SIGNUP_WINDOWS as readonly string[]).includes(rawSignup)
    ? (rawSignup as SignupWindow)
    : "all";

  const expiringSoon = readString(params.expiring) === "true";

  const pageParam = Number(readString(params.page));
  const page =
    Number.isFinite(pageParam) && pageParam >= 1 ? Math.floor(pageParam) : 1;

  const result = await listTenants({
    page,
    query: q || undefined,
    status,
    signupWindow,
    expiringWithinDays: expiringSoon ? platform.trialWarningDays : undefined,
  });

  return (
    <AdminTenantsClient
      tenants={result.tenants}
      pagination={{
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      }}
      initialQuery={q}
      activeStatus={status}
      activeSignup={signupWindow}
      activeExpiring={expiringSoon}
      reminderTemplate={platform.bulkReminderTemplate}
      locale={locale}
      dictionary={dictionary}
    />
  );
}