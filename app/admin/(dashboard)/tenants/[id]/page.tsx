// app/admin/(dashboard)/tenants/[id]/page.tsx

import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { getTenantDetail } from "@/lib/admin-db";
import { listAllPlans } from "@/lib/plans";
import { TenantDetailClient } from "./TenantDetailClient";

interface TenantPageProps {
  params: Promise<{ id: string }>;
}

export default async function TenantDetailPage({ params }: TenantPageProps) {
  const { id } = await params;
  const locale = await getLocale();
  const dictionary = getDictionary(locale);

  const [detail, plans] = await Promise.all([
    getTenantDetail(id),
    listAllPlans(),
  ]);
  if (!detail) notFound();

  // Only active plans can be granted via the admin modal.
  const activePlans = plans.filter((p) => p.active);

  return (
    <TenantDetailClient
      detail={detail}
      plans={activePlans}
      locale={locale}
      dictionary={dictionary}
    />
  );
}