// app/admin/(dashboard)/payments/page.tsx

import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { listPayments } from "@/lib/payments";
import { AdminPaymentsClient } from "./AdminPaymentsClient";
import type { PaymentStatus } from "@/types";

interface AdminPaymentsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function readString(value: string | string[] | undefined): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

const VALID_STATUSES: PaymentStatus[] = ["pending", "verified", "rejected"];

export default async function AdminPaymentsPage({
  searchParams,
}: AdminPaymentsPageProps) {
  const params = await searchParams;
  const locale = await getLocale();
  const dictionary = getDictionary(locale);

  const rawStatus = readString(params.status);
  const activeStatus: PaymentStatus | "all" =
    rawStatus === "all"
      ? "all"
      : VALID_STATUSES.includes(rawStatus as PaymentStatus)
        ? (rawStatus as PaymentStatus)
        : "pending";

  const listStatus: PaymentStatus | undefined =
    activeStatus === "all" ? undefined : activeStatus;

  const pageParam = Number(readString(params.page));
  const page =
    Number.isFinite(pageParam) && pageParam >= 1 ? Math.floor(pageParam) : 1;

  const result = await listPayments({ page, status: listStatus });

  return (
    <AdminPaymentsClient
      payments={result.payments}
      pagination={{
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      }}
      activeStatus={activeStatus}
      locale={locale}
      dictionary={dictionary}
    />
  );
}