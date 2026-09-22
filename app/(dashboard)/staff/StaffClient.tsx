// app/(dashboard)/staff/StaffClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { Modal } from "@/app/components/ui/Modal";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { useToast } from "@/app/components/ui/Toast";
import { StaffTable } from "@/app/components/staff/StaffTable";
import { StaffFormModal } from "@/app/components/staff/StaffFormModal";
import { translate, type Dictionary, type Locale } from "@/lib/i18n";
import type { SafeUser } from "@/types";

interface StaffClientProps {
  staff: SafeUser[];
  currentUserId: string;
  locale: Locale;
  dictionary: Dictionary;
}

const SEARCH_DEBOUNCE_MS = 300;

export function StaffClient({
  staff,
  currentUserId,
  locale,
  dictionary,
}: StaffClientProps) {
  const router = useRouter();
  const { push: pushToast } = useToast();

  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // undefined = closed, null = create, SafeUser = edit
  const [formTarget, setFormTarget] = useState<
    SafeUser | null | undefined
  >(undefined);

  const [deactivateTarget, setDeactivateTarget] = useState<SafeUser | null>(
    null
  );
  const [isDeactivating, setIsDeactivating] = useState(false);

  // Debounced client-side search — staff list is small.
  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedQuery(searchInput.trim()),
      SEARCH_DEBOUNCE_MS
    );
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const filtered = useMemo(() => {
    if (!debouncedQuery) return staff;
    const needle = debouncedQuery.toLowerCase();
    return staff.filter((user) => {
      return (
        user.name.toLowerCase().includes(needle) ||
        user.phone.toLowerCase().includes(needle) ||
        (user.email ?? "").toLowerCase().includes(needle)
      );
    });
  }, [staff, debouncedQuery]);

  const hasFilter = debouncedQuery.length > 0;

  // ── Handlers ─────────────────────────────────────────────────

  function handleAdd() {
    setFormTarget(null);
  }

  function handleEdit(user: SafeUser) {
    setFormTarget(user);
  }

  function handleFormSuccess() {
    setFormTarget(undefined);
    router.refresh();
  }

  // Toggle active via a single PATCH — unlike products/suppliers we don't
  // open a confirm modal for activation (only for deactivation, which is
  // the disruptive direction).
  async function handleToggleActive(user: SafeUser) {
    if (user.active) {
      // Deactivation is disruptive — confirm first.
      setDeactivateTarget(user);
      return;
    }
    // Reactivation — no confirm needed.
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true }),
      });
      if (!response.ok) throw new Error("Reactivate failed");
      pushToast({
        message: translate(dictionary, "staff.updated"),
        variant: "success",
      });
      router.refresh();
    } catch {
      pushToast({
        message: translate(dictionary, "errors.generic"),
        variant: "error",
      });
    }
  }

  async function confirmDeactivate() {
    if (!deactivateTarget || isDeactivating) return;
    setIsDeactivating(true);
    try {
      const response = await fetch(`/api/users/${deactivateTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      });
      if (!response.ok) {
        let body: { error?: { code?: string } } | null = null;
        try {
          body = (await response.json()) as { error?: { code?: string } };
        } catch {
          body = null;
        }
        const code = body?.error?.code;
        if (code === "OWNER_PROTECTED") {
          pushToast({
            message: translate(dictionary, "staff.errors.ownerProtected"),
            variant: "error",
          });
        } else if (code === "SELF_ACTIVE_LOCKED") {
          pushToast({
            message: translate(dictionary, "staff.errors.selfProtected"),
            variant: "error",
          });
        } else {
          pushToast({
            message: translate(dictionary, "errors.generic"),
            variant: "error",
          });
        }
        setDeactivateTarget(null);
        return;
      }
      pushToast({
        message: translate(dictionary, "staff.deactivated"),
        variant: "success",
      });
      setDeactivateTarget(null);
      router.refresh();
    } catch {
      pushToast({
        message: translate(dictionary, "errors.generic"),
        variant: "error",
      });
    } finally {
      setIsDeactivating(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {translate(dictionary, "staff.title")}
          </h1>
          <p className="text-sm text-text-muted">
            {translate(dictionary, "staff.subtitle")}
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={handleAdd}
          leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
        >
          {translate(dictionary, "staff.addStaff")}
        </Button>
      </div>

      {/* Search */}
      <div className="rounded-xl border border-border bg-surface p-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={translate(dictionary, "staff.searchPlaceholder")}
            aria-label={translate(dictionary, "staff.searchPlaceholder")}
            className="h-11 w-full rounded-lg border border-border bg-surface ps-9 pe-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          {hasFilter && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              aria-label={translate(dictionary, "inventory.filters.clear")}
              className="absolute inset-e-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-text-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {filtered.length === 0 && hasFilter ? (
        <EmptyState
          title={translate(dictionary, "staff.empty.filterTitle")}
          description={translate(
            dictionary,
            "staff.empty.filterDescription"
          )}
        />
      ) : staff.length === 1 ? (
        // Only the owner — no staff added yet.
        <EmptyState
          title={translate(dictionary, "staff.empty.title")}
          description={translate(dictionary, "staff.empty.description")}
          action={
            <Button type="button" variant="primary" onClick={handleAdd}>
              {translate(dictionary, "staff.addStaff")}
            </Button>
          }
        />
      ) : (
        <StaffTable
          staff={filtered}
          currentUserId={currentUserId}
          locale={locale}
          dictionary={dictionary}
          onEdit={handleEdit}
          onToggleActive={handleToggleActive}
        />
      )}

      {/* Modals */}
      <StaffFormModal
        isOpen={formTarget !== undefined}
        onClose={() => setFormTarget(undefined)}
        staff={formTarget ?? null}
        currentUserId={currentUserId}
        dictionary={dictionary}
        onSuccess={handleFormSuccess}
      />

      <Modal
        isOpen={deactivateTarget !== null}
        onClose={() => setDeactivateTarget(null)}
        title={translate(dictionary, "staff.deleteConfirm.title")}
        closeOnBackdropClick={!isDeactivating}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeactivateTarget(null)}
              disabled={isDeactivating}
            >
              {translate(dictionary, "staff.deleteConfirm.cancel")}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={confirmDeactivate}
              isLoading={isDeactivating}
            >
              {translate(dictionary, "staff.deleteConfirm.confirm")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-foreground">
          {translate(dictionary, "staff.deleteConfirm.description")}
        </p>
      </Modal>
    </div>
  );
}