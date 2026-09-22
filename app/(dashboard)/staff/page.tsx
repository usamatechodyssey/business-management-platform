// app/(dashboard)/staff/page.tsx
//
// Server Component. Requires "staff.manage" permission (owner-only per
// permissions matrix). Fetches the full staff list (including archived
// users so the table can show/reactivate them) and hands it to the
// client StaffClient.

import { getTenantContext, TenantError } from "@/lib/tenant";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { hasPermission } from "@/lib/permissions";
import { listStaff, toSafeUser } from "@/lib/staff";
import { StaffClient } from "./StaffClient";

export default async function StaffPage() {
  const tenant = await getTenantContext();

  if (!hasPermission(tenant.role, "staff.manage")) {
    throw new TenantError("You don't have permission to view staff.");
  }

  const locale = await getLocale();
  const dictionary = getDictionary(locale);

  const users = await listStaff(tenant.businessId);

  return (
    <StaffClient
      staff={users.map(toSafeUser)}
      currentUserId={tenant.userId}
      locale={locale}
      dictionary={dictionary}
    />
  );
}