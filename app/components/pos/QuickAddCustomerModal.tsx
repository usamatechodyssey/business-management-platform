// app/components/pos/QuickAddCustomerModal.tsx
"use client";

import { useEffect, useState, type SubmitEvent } from "react";
import { Modal } from "@/app/components/ui/Modal";
import { Input } from "@/app/components/ui/Input";
import { Button } from "@/app/components/ui/Button";
import { useToast } from "@/app/components/ui/Toast";
import { translate, type Dictionary } from "@/lib/i18n";
import type { Customer } from "@/types";

interface QuickAddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  dictionary: Dictionary;
  // Called with the newly-created customer so the POS can select it
  // immediately and continue checkout without a second lookup.
  onCreated: (customer: Customer) => void;
}

interface FormState {
  name: string;
  phone: string;
}

interface FieldErrors {
  name?: string;
  phone?: string;
}

const EMPTY_FORM: FormState = { name: "", phone: "" };

// POS-inline quick-add: only name + phone are collected here. The full
// CustomerFormModal (customers page) still owns the complete record —
// credit limit, due date, guarantor, tag, notes. The API accepts an
// empty payload for the optional fields, so this stays consistent.
export function QuickAddCustomerModal({
  isOpen,
  onClose,
  dictionary,
  onCreated,
}: QuickAddCustomerModalProps) {
  const { push } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(EMPTY_FORM);
    setErrors({});
    setFormError(null);
  }, [isOpen]);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    const name = form.name.trim();
    if (!name) {
      next.name = translate(dictionary, "pos.quickCustomer.errors.nameRequired");
    } else if (name.length > 100) {
      next.name = translate(dictionary, "customers.errors.nameMax");
    }
    const phone = form.phone.trim();
    if (!phone) {
      next.phone = translate(
        dictionary,
        "pos.quickCustomer.errors.phoneRequired"
      );
    } else if (phone.length < 10) {
      next.phone = translate(dictionary, "customers.errors.phoneMin");
    } else if (phone.length > 20) {
      next.phone = translate(dictionary, "customers.errors.phoneMax");
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

    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          // Every optional field is intentionally empty — the customers
          // page fills them in later if needed.
          address: "",
          creditLimit: "",
          dueDate: "",
          guarantorName: "",
          guarantorPhone: "",
          tag: "",
          notes: "",
        }),
      });

      if (response.ok) {
        const body = (await response.json()) as { data: Customer };
        onCreated(body.data);
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

      if (responseBody?.error?.code === "CUSTOMER_PHONE_TAKEN") {
        setErrors({
          phone: translate(dictionary, "customers.errors.phoneTaken"),
        });
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
      title={translate(dictionary, "pos.quickCustomer.title")}
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
            form="quick-customer-form"
            variant="primary"
            isLoading={isSubmitting}
          >
            {translate(dictionary, "pos.quickCustomer.save")}
          </Button>
        </>
      }
    >
      <form
        id="quick-customer-form"
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
          label={translate(dictionary, "pos.quickCustomer.nameLabel")}
          name="name"
          type="text"
          value={form.name}
          onChange={(event) =>
            setForm((current) => ({ ...current, name: event.target.value }))
          }
          error={errors.name}
          autoFocus
          required
          disabled={isSubmitting}
        />

        <Input
          label={translate(dictionary, "pos.quickCustomer.phoneLabel")}
          name="phone"
          type="tel"
          inputMode="tel"
          value={form.phone}
          onChange={(event) =>
            setForm((current) => ({ ...current, phone: event.target.value }))
          }
          error={errors.phone}
          required
          disabled={isSubmitting}
        />
      </form>
    </Modal>
  );
}