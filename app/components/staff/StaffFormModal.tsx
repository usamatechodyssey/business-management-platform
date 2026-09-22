// app/components/staff/StaffFormModal.tsx
"use client";

import { useEffect, useState, type SubmitEvent } from "react";
import { Modal } from "@/app/components/ui/Modal";
import { Input } from "@/app/components/ui/Input";
import { Select } from "@/app/components/ui/Select";
import { Button } from "@/app/components/ui/Button";
import { useToast } from "@/app/components/ui/Toast";
import { translate, type Dictionary, type TranslationKey } from "@/lib/i18n";
import type { SafeUser, UserRole } from "@/types";

interface StaffFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  // null → create mode. SafeUser → edit mode.
  staff: SafeUser | null;
  // Current user's id — used to hide role/active fields on self.
  currentUserId: string;
  dictionary: Dictionary;
  onSuccess: () => void;
}

interface FormState {
  name: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: Exclude<UserRole, "owner">;
  active: boolean;
}

interface FieldErrors {
  name?: string;
  phone?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  phone: "",
  email: "",
  password: "",
  confirmPassword: "",
  role: "cashier",
  active: true,
};

function staffToForm(user: SafeUser): FormState {
  return {
    name: user.name,
    phone: user.phone,
    email: user.email ?? "",
    password: "",
    confirmPassword: "",
    // Owner role never appears in staffToForm because owner edit hides
    // the role select entirely; but we still need a fallback that fits
    // the assignable subset if it ever runs for an owner.
    role:
      user.role === "owner" ? "manager" : (user.role as FormState["role"]),
    active: user.active,
  };
}

// Roles the staff form can assign. Mirrors ASSIGNABLE_ROLES in
// lib/staff.ts — the API rejects anything else.
const ROLE_OPTIONS: {
  value: FormState["role"];
  labelKey: TranslationKey;
}[] = [
  { value: "manager", labelKey: "roles.manager" },
  { value: "cashier", labelKey: "roles.cashier" },
  { value: "accountant", labelKey: "roles.accountant" },
];

export function StaffFormModal({
  isOpen,
  onClose,
  staff,
  currentUserId,
  dictionary,
  onSuccess,
}: StaffFormModalProps) {
  const { push } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEdit = staff !== null;
  const isOwner = staff?.role === "owner";
  const isSelf = staff !== null && staff.id === currentUserId;

  // Role + active are hidden for owner and self; server enforces the same
  // rule but we avoid the temptation entirely.
  const canChangeRole = !isOwner && !isSelf;
  const canChangeActive = !isOwner && !isSelf;

  useEffect(() => {
    if (!isOpen) return;
    setForm(staff ? staffToForm(staff) : EMPTY_FORM);
    setErrors({});
    setFormError(null);
  }, [isOpen, staff]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};

    const name = form.name.trim();
    if (!name) {
      next.name = translate(dictionary, "staff.errors.nameRequired");
    } else if (name.length > 100) {
      next.name = translate(dictionary, "staff.errors.nameMax");
    }

    const phone = form.phone.trim();
    if (!phone) {
      next.phone = translate(dictionary, "staff.errors.phoneRequired");
    } else if (phone.length < 10) {
      next.phone = translate(dictionary, "staff.errors.phoneMin");
    } else if (phone.length > 20) {
      next.phone = translate(dictionary, "staff.errors.phoneMax");
    }

    const email = form.email.trim();
    if (email !== "") {
      if (email.length > 254) {
        next.email = translate(dictionary, "staff.errors.emailMax");
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        next.email = translate(dictionary, "staff.errors.emailInvalid");
      }
    }

    // Password rules:
    //   create → required, must satisfy policy
    //   edit   → optional; if either field is touched, both must be
    //            filled and match
    const wantsPasswordChange =
      form.password.length > 0 || form.confirmPassword.length > 0;

    if (!isEdit || wantsPasswordChange) {
      if (form.password.length < 8) {
        next.password = translate(dictionary, "staff.errors.passwordMin");
      } else if (!/[A-Za-z]/.test(form.password)) {
        next.password = translate(dictionary, "staff.errors.passwordLetter");
      } else if (!/\d/.test(form.password)) {
        next.password = translate(dictionary, "staff.errors.passwordNumber");
      }

      if (form.password !== form.confirmPassword) {
        next.confirmPassword = translate(
          dictionary,
          "staff.errors.passwordMismatch"
        );
      }
    }

    return next;
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (isSubmitting) return;

    setFormError(null);
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setIsSubmitting(true);

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
    };

    if (canChangeRole) payload.role = form.role;
    if (canChangeActive) payload.active = form.active;
    if (!isEdit || form.password.length > 0) {
      payload.password = form.password;
    }

    try {
      const url = isEdit ? `/api/users/${staff.id}` : "/api/users";
      const method = isEdit ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        push({
          message: translate(
            dictionary,
            isEdit ? "staff.updated" : "staff.created"
          ),
          variant: "success",
        });
        onSuccess();
        return;
      }

      let responseBody: { error?: { code?: string } } | null = null;
      try {
        responseBody = (await response.json()) as {
          error?: { code?: string };
        };
      } catch {
        responseBody = null;
      }

      const code = responseBody?.error?.code;
      if (code === "PHONE_TAKEN") {
        setErrors({
          phone: translate(dictionary, "staff.errors.phoneTaken"),
        });
        return;
      }
      if (code === "EMAIL_TAKEN") {
        setErrors({
          email: translate(dictionary, "staff.errors.emailTaken"),
        });
        return;
      }
      if (
        code === "OWNER_PROTECTED" ||
        code === "OWNER_ROLE_LOCKED" ||
        code === "SELF_ROLE_LOCKED" ||
        code === "SELF_ACTIVE_LOCKED"
      ) {
        setFormError(translate(dictionary, "staff.errors.ownerProtected"));
        return;
      }

      setFormError(translate(dictionary, "errors.generic"));
    } catch {
      push({
        message: translate(dictionary, "errors.generic"),
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={translate(
        dictionary,
        isEdit ? "staff.editStaff" : "staff.addStaff"
      )}
      closeOnBackdropClick={!isSubmitting}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {translate(dictionary, "common.cancel")}
          </Button>
          <Button
            type="submit"
            form="staff-form"
            variant="primary"
            isLoading={isSubmitting}
          >
            {translate(dictionary, "common.save")}
          </Button>
        </>
      }
    >
      <form
        id="staff-form"
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col gap-4"
      >
        {formError && (
          <div
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            {formError}
          </div>
        )}

        <Input
          label={translate(dictionary, "staff.fields.name")}
          name="name"
          type="text"
          value={form.name}
          onChange={(event) => update("name", event.target.value)}
          error={errors.name}
          autoFocus
          required
          disabled={isSubmitting}
        />

        <Input
          label={translate(dictionary, "staff.fields.phone")}
          name="phone"
          type="tel"
          inputMode="tel"
          value={form.phone}
          onChange={(event) => update("phone", event.target.value)}
          error={errors.phone}
          required
          disabled={isSubmitting}
        />

        <Input
          label={translate(dictionary, "staff.fields.email")}
          name="email"
          type="email"
          inputMode="email"
          value={form.email}
          onChange={(event) => update("email", event.target.value)}
          error={errors.email}
          helperText={translate(dictionary, "staff.fields.emailHelper")}
          disabled={isSubmitting}
        />

        {canChangeRole && (
          <Select
            label={translate(dictionary, "staff.fields.role")}
            value={form.role}
            onChange={(event) =>
              update("role", event.target.value as FormState["role"])
            }
            options={ROLE_OPTIONS.map((opt) => ({
              value: opt.value,
              label: translate(dictionary, opt.labelKey),
            }))}
            helperText={translate(dictionary, "staff.fields.roleHelper")}
            disabled={isSubmitting}
          />
        )}

        <Input
          label={translate(dictionary, "staff.fields.password")}
          name="password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={(event) => update("password", event.target.value)}
          error={errors.password}
          helperText={translate(
            dictionary,
            isEdit ? "staff.fields.passwordEditHelper" : "staff.fields.passwordHelper"
          )}
          required={!isEdit}
          disabled={isSubmitting}
        />

        {( !isEdit || form.password.length > 0 || form.confirmPassword.length > 0 ) && (
          <Input
            label={translate(dictionary, "staff.fields.confirmPassword")}
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(event) => update("confirmPassword", event.target.value)}
            error={errors.confirmPassword}
            required={!isEdit}
            disabled={isSubmitting}
          />
        )}

        {canChangeActive && (
          <label className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => update("active", event.target.checked)}
              disabled={isSubmitting}
              className="mt-0.5 h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {translate(dictionary, "staff.fields.active")}
              </p>
              <p className="text-xs text-text-muted">
                {translate(dictionary, "staff.fields.activeHelper")}
              </p>
            </div>
          </label>
        )}
      </form>
    </Modal>
  );
}