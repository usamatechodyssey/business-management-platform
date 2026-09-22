// app/admin/(dashboard)/plans/AdminPlansClient.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Table, type TableColumn } from "@/app/components/ui/Table";
import { Badge } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import { Modal } from "@/app/components/ui/Modal";
import { useToast } from "@/app/components/ui/Toast";
import { PlanFormModal } from "./PlanFormModal";
import { formatCurrency } from "@/lib/format";
import { translate, type Dictionary } from "@/lib/i18n";
import { UNLIMITED } from "@/types";
import type { PlanTier } from "@/types";

interface AdminPlansClientProps {
  plans: PlanTier[];
  dictionary: Dictionary;
}

// Compact display for limits in the table. Unlimited shows "∞" so the
// column stays narrow.
function formatLimit(value: number): string {
  return value === UNLIMITED ? "∞" : String(value);
}

export function AdminPlansClient({
  plans,
  dictionary,
}: AdminPlansClientProps) {
  const router = useRouter();
  const { push } = useToast();

  // undefined = closed, null = create, plan = edit
  const [formTarget, setFormTarget] = useState<
    PlanTier | null | undefined
  >(undefined);

  const [deleteTarget, setDeleteTarget] = useState<PlanTier | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function handleAdd() {
    setFormTarget(null);
  }

  function handleEdit(plan: PlanTier) {
    setFormTarget(plan);
  }

  function handleFormSuccess() {
    setFormTarget(undefined);
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/admin/plans/${deleteTarget.id}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        let body: { error?: { code?: string; fields?: Record<string, string> } } | null = null;
        try {
          body = (await response.json()) as {
            error?: { code?: string; fields?: Record<string, string> };
          };
        } catch {
          body = null;
        }
        const code = body?.error?.code;
        if (code === "PLAN_IN_USE") {
          push({
            message: translate(dictionary, "admin.plans.errors.inUse", {
              count: body?.error?.fields?.count ?? "?",
            }),
            variant: "error",
          });
        } else if (code === "TRIAL_PROTECTED") {
          push({
            message: translate(dictionary, "admin.plans.errors.trialProtected"),
            variant: "error",
          });
        } else {
          push({
            message: translate(dictionary, "errors.generic"),
            variant: "error",
          });
        }
        setDeleteTarget(null);
        return;
      }
      push({
        message: translate(dictionary, "admin.plans.deleted"),
        variant: "success",
      });
      setDeleteTarget(null);
      router.refresh();
    } catch {
      push({
        message: translate(dictionary, "errors.generic"),
        variant: "error",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  const columns: TableColumn<PlanTier>[] = [
    {
      key: "name",
      header: translate(dictionary, "admin.plans.columns.name"),
      render: (p) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{p.name}</span>
          {p.isTrialPlan && (
            <Badge variant="primary">
              {translate(dictionary, "admin.plans.badges.trial")}
            </Badge>
          )}
          {!p.active && (
            <Badge variant="neutral">
              {translate(dictionary, "admin.plans.badges.inactive")}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "slug",
      header: translate(dictionary, "admin.plans.columns.slug"),
      render: (p) => (
        <span className="font-mono text-xs text-text-muted">{p.slug}</span>
      ),
    },
    {
      key: "priceMonthly",
      header: translate(dictionary, "admin.plans.columns.price"),
      align: "end",
      render: (p) => (
        <span className="tabular-nums">
          {p.priceMonthly === 0 ? "Free" : formatCurrency(p.priceMonthly)}
        </span>
      ),
    },
    {
      key: "limits",
      header: translate(dictionary, "admin.plans.columns.limits"),
      render: (p) => (
        <span className="text-xs text-text-muted">
          U:{formatLimit(p.limits.users)} · P:{formatLimit(p.limits.products)} · C:
          {formatLimit(p.limits.customers)}
        </span>
      ),
    },
    {
      key: "displayOrder",
      header: translate(dictionary, "admin.plans.columns.order"),
      align: "end",
      render: (p) => <span className="tabular-nums">{p.displayOrder}</span>,
    },
    {
      key: "id",
      header: translate(dictionary, "admin.plans.columns.actions"),
      align: "end",
      render: (p) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => handleEdit(p)}
            aria-label={translate(dictionary, "common.edit")}
            className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(p)}
            disabled={p.isTrialPlan}
            aria-label={translate(dictionary, "common.delete")}
            title={
              p.isTrialPlan
                ? translate(dictionary, "admin.plans.errors.trialProtected")
                : translate(dictionary, "common.delete")
            }
            className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text-muted"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {translate(dictionary, "admin.plans.title")}
          </h1>
          <p className="text-sm text-text-muted">
            {translate(dictionary, "admin.plans.subtitle")}
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={handleAdd}
          leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
        >
          {translate(dictionary, "admin.plans.addPlan")}
        </Button>
      </div>

      <Table
        columns={columns}
        data={plans}
        getRowId={(p) => p.id}
        emptyMessage={translate(dictionary, "admin.plans.empty")}
      />

      <PlanFormModal
        isOpen={formTarget !== undefined}
        onClose={() => setFormTarget(undefined)}
        plan={formTarget ?? null}
        existingPlans={plans}
        dictionary={dictionary}
        onSuccess={handleFormSuccess}
      />

      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={translate(dictionary, "admin.plans.deleteConfirm.title")}
        closeOnBackdropClick={!isDeleting}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              {translate(dictionary, "common.cancel")}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={confirmDelete}
              isLoading={isDeleting}
            >
              {translate(dictionary, "common.delete")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-foreground">
          {translate(dictionary, "admin.plans.deleteConfirm.description")}
        </p>
      </Modal>
    </div>
  );
}