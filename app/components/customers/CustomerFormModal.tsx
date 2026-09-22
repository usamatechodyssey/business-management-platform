// app/components/customers/CustomerFormModal.tsx
"use client";

import { useEffect, useState, type SubmitEvent } from "react";
import { Modal } from "@/app/components/ui/Modal";
import { Input } from "@/app/components/ui/Input";
import { Button } from "@/app/components/ui/Button";
import { useToast } from "@/app/components/ui/Toast";
import { translate, type Dictionary } from "@/lib/i18n";
import type { Customer, KhataSettings } from "@/types";

interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  // null → create mode. Non-null → edit mode.
  customer: Customer | null;
  // Drives which optional fields are shown. Values are still accepted by
  // the API regardless of settings, so stored data is never lost when
  // settings flip.
  khataSettings: KhataSettings;
  dictionary: Dictionary;
  onSuccess: () => void;
}

interface FormState {
  name: string;
  phone: string;
  address: string;
  creditLimit: string;
  dueDate: string;
  guarantorName: string;
  guarantorPhone: string;
  tag: string;
  notes: string;
}

interface FieldErrors {
  name?: string;
  phone?: string;
  address?: string;
  creditLimit?: string;
  dueDate?: string;
  guarantorName?: string;
  guarantorPhone?: string;
  tag?: string;
  notes?: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  phone: "",
  address: "",
  creditLimit: "",
  dueDate: "",
  guarantorName: "",
  guarantorPhone: "",
  tag: "",
  notes: "",
};

function customerToForm(c: Customer): FormState {
  return {
    name: c.name,
    phone: c.phone,
    address: c.address ?? "",
    creditLimit:
      c.creditLimit !== undefined ? String(c.creditLimit) : "",
    dueDate: c.dueDate ?? "",
    guarantorName: c.guarantorName ?? "",
    guarantorPhone: c.guarantorPhone ?? "",
    tag: c.tag ?? "",
    notes: c.notes ?? "",
  };
}

function validate(form: FormState, dictionary: Dictionary): FieldErrors {
  const errors: FieldErrors = {};

  const name = form.name.trim();
  if (!name) {
    errors.name = translate(dictionary, "customers.errors.nameRequired");
  } else if (name.length > 100) {
    errors.name = translate(dictionary, "customers.errors.nameMax");
  }

  const phone = form.phone.trim();
  if (!phone) {
    errors.phone = translate(dictionary, "customers.errors.phoneRequired");
  } else if (phone.length < 10) {
    errors.phone = translate(dictionary, "customers.errors.phoneMin");
  } else if (phone.length > 20) {
    errors.phone = translate(dictionary, "customers.errors.phoneMax");
  }

  if (form.address.length > 200) {
    errors.address = translate(dictionary, "customers.errors.addressMax");
  }

  if (form.creditLimit.trim() !== "") {
    const limit = Number(form.creditLimit);
    if (!Number.isFinite(limit) || limit < 0) {
      errors.creditLimit = translate(
        dictionary,
        "customers.errors.creditLimitInvalid"
      );
    }
  }

  if (form.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(form.dueDate)) {
    errors.dueDate = translate(dictionary, "errors.generic");
  }

  if (form.guarantorName.length > 100) {
    errors.guarantorName = translate(
      dictionary,
      "customers.errors.guarantorNameMax"
    );
  }
  if (form.guarantorPhone.length > 20) {
    errors.guarantorPhone = translate(
      dictionary,
      "customers.errors.guarantorPhoneMax"
    );
  }
  if (form.tag.length > 50) {
    errors.tag = translate(dictionary, "customers.errors.tagMax");
  }
  if (form.notes.length > 500) {
    errors.notes = translate(dictionary, "customers.errors.notesMax");
  }

  return errors;
}

export function CustomerFormModal({
  isOpen,
  onClose,
  customer,
  khataSettings,
  dictionary,
  onSuccess,
}: CustomerFormModalProps) {
  const { push } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEdit = customer !== null;

  useEffect(() => {
    if (!isOpen) return;
    setForm(customer ? customerToForm(customer) : EMPTY_FORM);
    setErrors({});
    setFormError(null);
  }, [isOpen, customer]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (isSubmitting) return;

    setFormError(null);
    const validationErrors = validate(form, dictionary);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setIsSubmitting(true);

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      creditLimit:
        form.creditLimit.trim() === "" ? "" : Number(form.creditLimit),
      dueDate: form.dueDate,
      guarantorName: form.guarantorName.trim(),
      guarantorPhone: form.guarantorPhone.trim(),
      tag: form.tag.trim(),
      notes: form.notes.trim(),
    };

    try {
      const url = isEdit
        ? `/api/customers/${customer.id}`
        : "/api/customers";
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
            isEdit ? "customers.updated" : "customers.created"
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
      title={translate(
        dictionary,
        isEdit ? "customers.editCustomer" : "customers.addCustomer"
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
            form="customer-form"
            variant="primary"
            isLoading={isSubmitting}
          >
            {translate(dictionary, "common.save")}
          </Button>
        </>
      }
    >
      <form
        id="customer-form"
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
          label={translate(dictionary, "customers.fields.name")}
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
          label={translate(dictionary, "customers.fields.phone")}
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
          label={translate(dictionary, "customers.fields.address")}
          name="address"
          type="text"
          value={form.address}
          onChange={(event) => update("address", event.target.value)}
          error={errors.address}
          disabled={isSubmitting}
        />

        {khataSettings.customerTagsEnabled && (
          <Input
            label={translate(dictionary, "customers.fields.tag")}
            name="tag"
            type="text"
            value={form.tag}
            onChange={(event) => update("tag", event.target.value)}
            error={errors.tag}
            disabled={isSubmitting}
          />
        )}

        {khataSettings.creditLimitEnabled && (
          <Input
            label={translate(dictionary, "customers.fields.creditLimit")}
            name="creditLimit"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={form.creditLimit}
            onChange={(event) => update("creditLimit", event.target.value)}
            error={errors.creditLimit}
            disabled={isSubmitting}
          />
        )}

        {khataSettings.dueDateTrackingEnabled && (
          <Input
            label={translate(dictionary, "customers.fields.dueDate")}
            name="dueDate"
            type="date"
            value={form.dueDate}
            onChange={(event) => update("dueDate", event.target.value)}
            error={errors.dueDate}
            disabled={isSubmitting}
          />
        )}

        {khataSettings.guarantorEnabled && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={translate(dictionary, "customers.fields.guarantorName")}
              name="guarantorName"
              type="text"
              value={form.guarantorName}
              onChange={(event) =>
                update("guarantorName", event.target.value)
              }
              error={errors.guarantorName}
              disabled={isSubmitting}
            />
            <Input
              label={translate(
                dictionary,
                "customers.fields.guarantorPhone"
              )}
              name="guarantorPhone"
              type="tel"
              inputMode="tel"
              value={form.guarantorPhone}
              onChange={(event) =>
                update("guarantorPhone", event.target.value)
              }
              error={errors.guarantorPhone}
              disabled={isSubmitting}
            />
          </div>
        )}

        <Input
          label={translate(dictionary, "customers.fields.notes")}
          name="notes"
          type="text"
          value={form.notes}
          onChange={(event) => update("notes", event.target.value)}
          error={errors.notes}
          helperText={translate(dictionary, "common.optional")}
          disabled={isSubmitting}
        />
      </form>
    </Modal>
  );
}