// app/admin/(dashboard)/tenants/[id]/TenantDetailClient.tsx
"use client";

import { useState, type SubmitEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  KeyRound,
  LogIn,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Badge } from "@/app/components/ui/Badge";
import { Modal } from "@/app/components/ui/Modal";
import { useToast } from "@/app/components/ui/Toast";
import { formatDate } from "@/lib/format";
import { translate, type Dictionary, type Locale } from "@/lib/i18n";
import type { Business, PlanTier } from "@/types";

interface TenantDetail {
  business: Business;
  owner: { id: string; name: string; phone: string } | null;
  counts: {
    users: number;
    products: number;
    suppliers: number;
    purchases: number;
    customers: number;
    sales: number;
  };
}

interface TenantDetailClientProps {
  detail: TenantDetail;
  plans: PlanTier[];
  locale: Locale;
  dictionary: Dictionary;
}

function statusVariant(status: string | undefined) {
  if (status === "active") return "success" as const;
  if (status === "trial") return "primary" as const;
  if (status === "suspended") return "warning" as const;
  if (status === "expired") return "danger" as const;
  return "neutral" as const;
}

export function TenantDetailClient({
  detail,
  plans,
  locale,
  dictionary,
}: TenantDetailClientProps) {
  const router = useRouter();
  const { push } = useToast();

  const [suspendOpen, setSuspendOpen] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [impersonateOpen, setImpersonateOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const { business, owner, counts } = detail;
  const sub = business.subscription;

  const planName = sub ? plans.find((p) => p.slug === sub.plan)?.name ?? sub.plan : null;

  async function postAction(path: string, body?: unknown, method = "POST") {
    setIsBusy(true);
    try {
      const response = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) throw new Error("Request failed");
      return true;
    } catch {
      push({
        message: translate(dictionary, "errors.generic"),
        variant: "error",
      });
      return false;
    } finally {
      setIsBusy(false);
    }
  }

  async function handleActivate() {
    const ok = await postAction(
      `/api/admin/tenants/${business.id}`,
      { action: "activate" },
      "PATCH"
    );
    if (ok) {
      push({
        message: translate(dictionary, "admin.tenantDetail.activated"),
        variant: "success",
      });
      router.refresh();
    }
  }

  async function handleSuspendConfirm(reason: string) {
    const ok = await postAction(
      `/api/admin/tenants/${business.id}`,
      { action: "suspend", reason },
      "PATCH"
    );
    if (ok) {
      push({
        message: translate(dictionary, "admin.tenantDetail.suspended"),
        variant: "success",
      });
      setSuspendOpen(false);
      router.refresh();
    }
  }

  async function handleGrantConfirm(
    months: number,
    planSlug: string,
    notes: string
  ) {
    const ok = await postAction(`/api/admin/tenants/${business.id}/grant`, {
      months,
      plan: planSlug,
      notes,
    });
    if (ok) {
      push({
        message: translate(dictionary, "admin.tenantDetail.granted"),
        variant: "success",
      });
      setGrantOpen(false);
      router.refresh();
    }
  }

  async function handleResetConfirm(newPassword: string) {
    const ok = await postAction(
      `/api/admin/tenants/${business.id}/reset-owner-password`,
      { newPassword }
    );
    if (ok) {
      push({
        message: translate(dictionary, "admin.tenantDetail.passwordReset"),
        variant: "success",
      });
      setResetOpen(false);
    }
  }

  async function handleImpersonateConfirm() {
    const ok = await postAction(
      `/api/admin/tenants/${business.id}/impersonate`
    );
    if (ok) {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {translate(dictionary, "admin.tenantDetail.back")}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">
            {business.name}
          </h1>
          <Badge variant={statusVariant(sub?.status)}>
            {translate(
              dictionary,
              sub?.status === "active"
                ? "admin.tenants.status.active"
                : sub?.status === "trial"
                  ? "admin.tenants.status.trial"
                  : sub?.status === "suspended"
                    ? "admin.tenants.status.suspended"
                    : sub?.status === "expired"
                      ? "admin.tenants.status.expired"
                      : "admin.tenants.status.none"
            )}
          </Badge>
        </div>
        <p className="mt-0.5 text-sm text-text-muted">
          {translate(dictionary, "admin.tenantDetail.createdOn", {
            date: formatDate(business.createdAt, locale),
          })}
          {owner && ` · ${owner.name} · ${owner.phone}`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <CountCard label={translate(dictionary, "admin.tenantDetail.counts.users")} value={counts.users} />
        <CountCard label={translate(dictionary, "admin.tenantDetail.counts.products")} value={counts.products} />
        <CountCard label={translate(dictionary, "admin.tenantDetail.counts.suppliers")} value={counts.suppliers} />
        <CountCard label={translate(dictionary, "admin.tenantDetail.counts.purchases")} value={counts.purchases} />
        <CountCard label={translate(dictionary, "admin.tenantDetail.counts.customers")} value={counts.customers} />
        <CountCard label={translate(dictionary, "admin.tenantDetail.counts.sales")} value={counts.sales} />
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="text-base font-semibold text-foreground">
          {translate(dictionary, "admin.tenantDetail.subscription.heading")}
        </h2>
        {sub ? (
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-text-muted">
                {translate(dictionary, "admin.tenantDetail.subscription.status")}
              </dt>
              <dd className="mt-0.5 font-medium text-foreground">{sub.status}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">
                {translate(dictionary, "admin.tenantDetail.subscription.plan")}
              </dt>
              <dd className="mt-0.5 font-medium text-foreground">{planName}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">
                {translate(dictionary, "admin.tenantDetail.subscription.expiresAt")}
              </dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {formatDate(sub.expiresAt, locale)}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-text-muted">
            {translate(dictionary, "admin.tenantDetail.subscription.notSet")}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {sub?.status === "suspended" ? (
          <Button
            type="button"
            variant="primary"
            onClick={handleActivate}
            disabled={isBusy}
            leadingIcon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
          >
            {translate(dictionary, "admin.tenantDetail.actions.activate")}
          </Button>
        ) : (
          <Button
            type="button"
            variant="danger"
            onClick={() => setSuspendOpen(true)}
            disabled={isBusy}
            leadingIcon={<Ban className="h-4 w-4" aria-hidden="true" />}
          >
            {translate(dictionary, "admin.tenantDetail.actions.suspend")}
          </Button>
        )}

        <Button
          type="button"
          variant="secondary"
          onClick={() => setGrantOpen(true)}
          disabled={isBusy}
          leadingIcon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
        >
          {translate(dictionary, "admin.tenantDetail.actions.grant")}
        </Button>

        <Button
          type="button"
          variant="secondary"
          onClick={() => setResetOpen(true)}
          disabled={isBusy || !owner}
          leadingIcon={<KeyRound className="h-4 w-4" aria-hidden="true" />}
        >
          {translate(dictionary, "admin.tenantDetail.actions.resetPassword")}
        </Button>

        <Button
          type="button"
          variant="secondary"
          onClick={() => setImpersonateOpen(true)}
          disabled={isBusy || !owner}
          leadingIcon={<LogIn className="h-4 w-4" aria-hidden="true" />}
        >
          {translate(dictionary, "admin.tenantDetail.actions.impersonate")}
        </Button>
      </div>

      <SuspendModal
        isOpen={suspendOpen}
        onClose={() => setSuspendOpen(false)}
        onConfirm={handleSuspendConfirm}
        isBusy={isBusy}
        dictionary={dictionary}
      />
      <GrantModal
        isOpen={grantOpen}
        onClose={() => setGrantOpen(false)}
        onConfirm={handleGrantConfirm}
        plans={plans}
        isBusy={isBusy}
        dictionary={dictionary}
      />
      <ResetPasswordModal
        isOpen={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={handleResetConfirm}
        isBusy={isBusy}
        dictionary={dictionary}
      />
      <SimpleConfirmModal
        isOpen={impersonateOpen}
        title={translate(dictionary, "admin.tenantDetail.impersonate.title")}
        description={translate(dictionary, "admin.tenantDetail.impersonate.description")}
        confirmLabel={translate(dictionary, "admin.tenantDetail.impersonate.confirm")}
        cancelLabel={translate(dictionary, "admin.tenantDetail.impersonate.cancel")}
        onClose={() => setImpersonateOpen(false)}
        onConfirm={async () => {
          setImpersonateOpen(false);
          await handleImpersonateConfirm();
        }}
        isBusy={isBusy}
        variant="primary"
      />
    </div>
  );
}

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 shadow-sm">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}

interface ModalBaseProps {
  isOpen: boolean;
  onClose: () => void;
  isBusy: boolean;
  dictionary: Dictionary;
}

function SuspendModal({
  isOpen,
  onClose,
  onConfirm,
  isBusy,
  dictionary,
}: ModalBaseProps & { onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={translate(dictionary, "admin.tenantDetail.suspend.title")}
      closeOnBackdropClick={!isBusy}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isBusy}>
            {translate(dictionary, "admin.tenantDetail.suspend.cancel")}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => onConfirm(reason.trim())}
            isLoading={isBusy}
          >
            {translate(dictionary, "admin.tenantDetail.suspend.confirm")}
          </Button>
        </>
      }
    >
      <p className="text-sm text-foreground">
        {translate(dictionary, "admin.tenantDetail.suspend.description")}
      </p>
      <div className="mt-4">
        <Input
          label={translate(dictionary, "admin.tenantDetail.suspend.reasonLabel")}
          name="reason"
          type="text"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          helperText={translate(dictionary, "admin.tenantDetail.suspend.reasonPlaceholder")}
          disabled={isBusy}
        />
      </div>
    </Modal>
  );
}

function GrantModal({
  isOpen,
  onClose,
  onConfirm,
  plans,
  isBusy,
  dictionary,
}: ModalBaseProps & {
  plans: PlanTier[];
  onConfirm: (months: number, planSlug: string, notes: string) => void;
}) {
  const [months, setMonths] = useState("1");
  const [planSlug, setPlanSlug] = useState(plans[0]?.slug ?? "");
  const [notes, setNotes] = useState("");

  const monthsNum = Number(months);
  const monthsValid = Number.isInteger(monthsNum) && monthsNum >= 1 && monthsNum <= 36;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={translate(dictionary, "admin.tenantDetail.grant.title")}
      closeOnBackdropClick={!isBusy}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isBusy}>
            {translate(dictionary, "admin.tenantDetail.grant.cancel")}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => onConfirm(monthsNum, planSlug, notes.trim())}
            isLoading={isBusy}
            disabled={!monthsValid || !planSlug}
          >
            {translate(dictionary, "admin.tenantDetail.grant.confirm")}
          </Button>
        </>
      }
    >
      <p className="text-sm text-foreground">
        {translate(dictionary, "admin.tenantDetail.grant.description")}
      </p>
      <div className="mt-4 flex flex-col gap-4">
        <Input
          label={translate(dictionary, "admin.tenantDetail.grant.monthsLabel")}
          name="months"
          type="number"
          inputMode="numeric"
          min={1}
          max={36}
          value={months}
          onChange={(event) => setMonths(event.target.value)}
          disabled={isBusy}
          required
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">
            {translate(dictionary, "admin.tenantDetail.grant.planLabel")}
          </span>
          <select
            value={planSlug}
            onChange={(event) => setPlanSlug(event.target.value)}
            disabled={isBusy}
            className="h-11 rounded-lg border border-border bg-surface px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {plans.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <Input
          label={translate(dictionary, "admin.tenantDetail.grant.notesLabel")}
          name="notes"
          type="text"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          disabled={isBusy}
        />
      </div>
    </Modal>
  );
}

function ResetPasswordModal({
  isOpen,
  onClose,
  onConfirm,
  isBusy,
  dictionary,
}: ModalBaseProps & { onConfirm: (password: string) => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError(
        translate(dictionary, "admin.tenantDetail.resetPassword.passwordHelper")
      );
      return;
    }
    if (password !== confirm) {
      setError(translate(dictionary, "admin.tenantDetail.resetPassword.mismatch"));
      return;
    }
    onConfirm(password);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={translate(dictionary, "admin.tenantDetail.resetPassword.title")}
      closeOnBackdropClick={!isBusy}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isBusy}>
            {translate(dictionary, "admin.tenantDetail.resetPassword.cancel")}
          </Button>
          <Button type="button" variant="primary" onClick={handleConfirm} isLoading={isBusy}>
            {translate(dictionary, "admin.tenantDetail.resetPassword.confirm")}
          </Button>
        </>
      }
    >
      <p className="text-sm text-foreground">
        {translate(dictionary, "admin.tenantDetail.resetPassword.description")}
      </p>
      <div className="mt-4 flex flex-col gap-4">
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            {error}
          </div>
        )}
        <Input
          label={translate(dictionary, "admin.tenantDetail.resetPassword.passwordLabel")}
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          helperText={translate(dictionary, "admin.tenantDetail.resetPassword.passwordHelper")}
          disabled={isBusy}
        />
        <Input
          label={translate(dictionary, "admin.tenantDetail.resetPassword.confirmPasswordLabel")}
          name="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          disabled={isBusy}
        />
      </div>
    </Modal>
  );
}

function SimpleConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onClose,
  onConfirm,
  isBusy,
  variant = "primary",
}: {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  isBusy: boolean;
  variant?: "primary" | "danger";
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      closeOnBackdropClick={!isBusy}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isBusy}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={variant} onClick={onConfirm} isLoading={isBusy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-foreground">{description}</p>
    </Modal>
  );
}