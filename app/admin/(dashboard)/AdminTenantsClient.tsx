// app/admin/(dashboard)/AdminTenantsClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Filter, MessageCircle, Search, X } from "lucide-react";
import { Table, type TableColumn } from "@/app/components/ui/Table";
import { Badge } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import { Pagination } from "@/app/components/ui/Pagination";
import { BulkWhatsAppModal } from "@/app/components/admin/BulkWhatsAppModal";
import { formatDate } from "@/lib/format";
import { translate, type Dictionary, type Locale } from "@/lib/i18n";
import { daysUntilExpiry } from "@/lib/trial";
import type { Business } from "@/types";

interface AdminTenantsClientProps {
  tenants: Business[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  initialQuery: string;
  activeStatus: "all" | "trial" | "active" | "expired" | "suspended";
  activeSignup: "all" | "today" | "week" | "month" | "year";
  activeExpiring: boolean;
  reminderTemplate: string;
  locale: Locale;
  dictionary: Dictionary;
}

const SEARCH_DEBOUNCE_MS = 300;

// ── Effective status ───────────────────────────────────────────
//
// Combines the raw `subscription.status` field with the expiry date.
// A tenant whose status field still says "trial"/"active" but whose
// expiry has passed is functionally expired — the badge must say so,
// otherwise the table reads as if it's still running.

type EffectiveStatus = "trial" | "active" | "expired" | "suspended" | "none";

function effectiveStatus(business: Business): EffectiveStatus {
  const sub = business.subscription;
  if (!sub) return "none";
  if (sub.status === "suspended") return "suspended";
  if (sub.status === "expired") return "expired";
  if (new Date(sub.expiresAt).getTime() < Date.now()) return "expired";
  return sub.status === "active" ? "active" : "trial";
}

function statusBadgeVariant(
  status: EffectiveStatus
): "primary" | "success" | "warning" | "danger" | "neutral" {
  if (status === "active") return "success";
  if (status === "trial") return "primary";
  if (status === "suspended") return "warning";
  if (status === "expired") return "danger";
  return "neutral";
}

function statusLabelKey(status: EffectiveStatus) {
  if (status === "active") return "admin.tenants.status.active" as const;
  if (status === "trial") return "admin.tenants.status.trial" as const;
  if (status === "suspended") return "admin.tenants.status.suspended" as const;
  if (status === "expired") return "admin.tenants.status.expired" as const;
  return "admin.tenants.status.none" as const;
}

// Human-readable days-left label for the table cell.
function daysLeftLabel(
  business: Business,
  dictionary: Dictionary
): string {
  const sub = business.subscription;
  if (!sub) return translate(dictionary, "admin.tenants.status.none");

  const days = daysUntilExpiry(sub.expiresAt);

  if (days < 0) {
    const abs = Math.abs(days);
    return abs === 1
      ? translate(dictionary, "admin.tenants.oneDayAgo")
      : translate(dictionary, "admin.tenants.daysAgo", { count: abs });
  }
  if (days === 0) return translate(dictionary, "admin.tenants.endsToday");
  if (days === 1) return translate(dictionary, "admin.tenants.oneDay");
  return translate(dictionary, "admin.tenants.daysLeft", { count: days });
}

export function AdminTenantsClient({
  tenants,
  pagination,
  initialQuery,
  activeStatus,
  activeSignup,
  activeExpiring,
  reminderTemplate,
  locale,
  dictionary,
}: AdminTenantsClientProps) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  // Reset selection whenever the visible set changes (page nav, filter
  // change). Otherwise we'd send WhatsApp to tenants that dropped off
  // the current view.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [tenants]);

  useEffect(() => {
    if (searchInput === initialQuery) return;
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (searchInput.trim()) params.set("q", searchInput.trim());
      if (activeStatus !== "all") params.set("status", activeStatus);
      if (activeSignup !== "all") params.set("signup", activeSignup);
      if (activeExpiring) params.set("expiring", "true");
      const qs = params.toString();
      router.push(qs ? `/admin?${qs}` : "/admin");
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function applyFilter(
    updates: Partial<{
      status: typeof activeStatus;
      signup: typeof activeSignup;
      expiring: boolean;
    }>
  ) {
    const nextStatus = updates.status ?? activeStatus;
    const nextSignup = updates.signup ?? activeSignup;
    const nextExpiring = updates.expiring ?? activeExpiring;

    const params = new URLSearchParams();
    if (searchInput.trim()) params.set("q", searchInput.trim());
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (nextSignup !== "all") params.set("signup", nextSignup);
    if (nextExpiring) params.set("expiring", "true");
    const qs = params.toString();
    router.push(qs ? `/admin?${qs}` : "/admin");
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(tenants.map((t) => t.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  const selectedTenants = useMemo(
    () => tenants.filter((t) => selectedIds.has(t.id)),
    [tenants, selectedIds]
  );

  const hasActiveFilters =
    activeStatus !== "all" || activeSignup !== "all" || activeExpiring;

  const columns: TableColumn<Business>[] = [
    {
      key: "select",
      header: "",
      render: (b) => (
        <input
          type="checkbox"
          checked={selectedIds.has(b.id)}
          onChange={() => toggleSelect(b.id)}
          className="h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={`Select ${b.name}`}
        />
      ),
    },
    {
      key: "name",
      header: translate(dictionary, "admin.tenants.columns.name"),
      render: (b) => (
        <Link
          href={`/admin/tenants/${b.id}`}
          className="font-medium text-foreground hover:text-primary"
        >
          {b.name}
        </Link>
      ),
    },
    {
      key: "ownerName",
      header: translate(dictionary, "admin.tenants.columns.owner"),
    },
    {
      key: "phone",
      header: translate(dictionary, "admin.tenants.columns.phone"),
    },
    {
      key: "statusBadge",
      header: translate(dictionary, "admin.tenants.columns.subscription"),
      render: (b) => {
        const status = effectiveStatus(b);
        return (
          <Badge variant={statusBadgeVariant(status)}>
            {translate(dictionary, statusLabelKey(status))}
          </Badge>
        );
      },
    },
    {
      key: "daysLeft",
      header: translate(dictionary, "admin.tenants.columns.daysLeft"),
      render: (b) => (
        <span className="text-xs text-text-muted">
          {daysLeftLabel(b, dictionary)}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: translate(dictionary, "admin.tenants.columns.created"),
      render: (b) => formatDate(b.createdAt, locale),
    },
    {
      key: "actions",
      header: translate(dictionary, "admin.tenants.columns.actions"),
      align: "end",
      render: (b) => (
        <Link
          href={`/admin/tenants/${b.id}`}
          className="rounded-md px-2 py-1 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
        >
          {translate(dictionary, "admin.tenants.view")}
        </Link>
      ),
    },
  ];

  // Derive a renewal URL from window.location.origin when we render.
  // Safe because this component only ever runs on the client.
  const renewalUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/billing`
      : "/billing";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          {translate(dictionary, "admin.tenants.title")}
        </h1>
        <p className="text-sm text-text-muted">
          {translate(dictionary, "admin.tenants.subtitle")}
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          aria-hidden="true"
        />
        <input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder={translate(
            dictionary,
            "admin.tenants.searchPlaceholder"
          )}
          className="h-11 w-full rounded-lg border border-border bg-surface ps-9 pe-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-text-muted" aria-hidden="true" />
        <FilterChip
          label={translate(dictionary, "admin.tenants.filters.statusAll")}
          active={activeStatus === "all"}
          onClick={() => applyFilter({ status: "all" })}
        />
        <FilterChip
          label={translate(dictionary, "admin.tenants.filters.statusTrial")}
          active={activeStatus === "trial"}
          onClick={() => applyFilter({ status: "trial" })}
        />
        <FilterChip
          label={translate(dictionary, "admin.tenants.filters.statusActive")}
          active={activeStatus === "active"}
          onClick={() => applyFilter({ status: "active" })}
        />
        <FilterChip
          label={translate(dictionary, "admin.tenants.filters.statusExpired")}
          active={activeStatus === "expired"}
          onClick={() => applyFilter({ status: "expired" })}
        />
        <FilterChip
          label={translate(dictionary, "admin.tenants.filters.statusSuspended")}
          active={activeStatus === "suspended"}
          onClick={() => applyFilter({ status: "suspended" })}
        />

        <span className="text-text-muted">·</span>

        <FilterChip
          label={translate(dictionary, "admin.tenants.filters.signupAll")}
          active={activeSignup === "all"}
          onClick={() => applyFilter({ signup: "all" })}
        />
        <FilterChip
          label={translate(dictionary, "admin.tenants.filters.signupToday")}
          active={activeSignup === "today"}
          onClick={() => applyFilter({ signup: "today" })}
        />
        <FilterChip
          label={translate(dictionary, "admin.tenants.filters.signupWeek")}
          active={activeSignup === "week"}
          onClick={() => applyFilter({ signup: "week" })}
        />
        <FilterChip
          label={translate(dictionary, "admin.tenants.filters.signupMonth")}
          active={activeSignup === "month"}
          onClick={() => applyFilter({ signup: "month" })}
        />

        <span className="text-text-muted">·</span>

        <FilterChip
          label={translate(dictionary, "admin.tenants.filters.expiringSoon")}
          active={activeExpiring}
          onClick={() => applyFilter({ expiring: !activeExpiring })}
          tone="warning"
        />

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              router.push("/admin");
            }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-text-muted hover:bg-surface-muted hover:text-foreground"
          >
            <X className="h-3 w-3" aria-hidden="true" />
            {translate(dictionary, "admin.tenants.filters.clear")}
          </button>
        )}
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-sm font-medium text-foreground">
            {translate(dictionary, "admin.tenants.bulk.selected", {
              count: selectedIds.size,
            })}
          </span>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setBulkOpen(true)}
            leadingIcon={
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
            }
          >
            {translate(dictionary, "admin.tenants.bulk.sendReminders")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearSelection}
          >
            {translate(dictionary, "admin.tenants.bulk.clearSelection")}
          </Button>
          <button
            type="button"
            onClick={selectAll}
            className="ms-auto text-xs font-medium text-primary hover:underline"
          >
            {translate(dictionary, "admin.tenants.bulk.selectAll")}
          </button>
        </div>
      )}

      {tenants.length === 0 && !initialQuery && !hasActiveFilters ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-sm font-medium text-foreground">
            {translate(dictionary, "admin.tenants.empty.title")}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {translate(dictionary, "admin.tenants.empty.description")}
          </p>
        </div>
      ) : tenants.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-sm font-medium text-foreground">
            {translate(dictionary, "admin.tenants.empty.filterTitle")}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {translate(dictionary, "admin.tenants.empty.filterDescription")}
          </p>
        </div>
      ) : (
        <>
          <Table
            columns={columns}
            data={tenants}
            getRowId={(b) => b.id}
          />
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            dictionary={dictionary}
          />
        </>
      )}

      <BulkWhatsAppModal
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
        tenants={selectedTenants}
        template={reminderTemplate}
        renewalUrl={renewalUrl}
        locale={locale}
        dictionary={dictionary}
      />
    </div>
  );
}

// ── Filter chip ────────────────────────────────────────────────

function FilterChip({
  label,
  active,
  onClick,
  tone = "primary",
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  tone?: "primary" | "warning";
}) {
  const activeClass =
    tone === "warning"
      ? "border-warning/40 bg-warning/10 text-warning"
      : "border-primary bg-primary/10 text-primary";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        active
          ? activeClass
          : "border-border bg-surface text-text-muted hover:bg-surface-muted",
      ].join(" ")}
    >
      {label}
    </button>
  );
}