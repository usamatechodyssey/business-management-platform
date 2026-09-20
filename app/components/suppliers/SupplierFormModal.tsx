// app/components/suppliers/SupplierFormModal.tsx
"use client";

import { useEffect, useState, type SubmitEvent } from "react";
import { Modal } from "@/app/components/ui/Modal";
import { Input } from "@/app/components/ui/Input";
import { Button } from "@/app/components/ui/Button";
import { useToast } from "@/app/components/ui/Toast";
import { translate, type Dictionary } from "@/lib/i18n";
import type { Supplier } from "@/types";

interface SupplierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  // null → create mode. Non-null → edit mode.
  supplier: Supplier | null;
  dictionary: Dictionary;
  onSuccess: () => void;
}

interface FormState {
  name: string;
  phone: string;
  address: string;
  contactPerson: string;
}

interface FieldErrors {
  name?: string;
  phone?: string;
  address?: string;
  contactPerson?: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  phone: "",
  address: "",
  contactPerson: "",
};

function supplierToForm(s: Supplier): FormState {
  return {
    name: s.name,
    phone: s.phone,
    address: s.address ?? "",
    contactPerson: s.contactPerson ?? "",
  };
}

function validate(form: FormState, dictionary: Dictionary): FieldErrors {
  const errors: FieldErrors = {};

  const name = form.name.trim();
  if (!name) {
    errors.name = translate(dictionary, "suppliers.errors.nameRequired");
  } else if (name.length > 100) {
    errors.name = translate(dictionary, "suppliers.errors.nameMax");
  }

  const phone = form.phone.trim();
  if (!phone) {
    errors.phone = translate(dictionary, "suppliers.errors.phoneRequired");
  } else if (phone.length < 10) {
    errors.phone = translate(dictionary, "suppliers.errors.phoneMin");
  } else if (phone.length > 20) {
    errors.phone = translate(dictionary, "suppliers.errors.phoneMax");
  }

  if (form.address.length > 200) {
    errors.address = translate(dictionary, "suppliers.errors.addressMax");
  }
  if (form.contactPerson.length > 100) {
    errors.contactPerson = translate(
      dictionary,
      "suppliers.errors.contactPersonMax"
    );
  }

  return errors;
}

export function SupplierFormModal({
  isOpen,
  onClose,
  supplier,
  dictionary,
  onSuccess,
}: SupplierFormModalProps) {
  const { push } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEdit = supplier !== null;

  useEffect(() => {
    if (!isOpen) return;
    setForm(supplier ? supplierToForm(supplier) : EMPTY_FORM);
    setErrors({});
    setFormError(null);
  }, [isOpen, supplier]);

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
      contactPerson: form.contactPerson.trim(),
    };

    try {
      const url = isEdit ? `/api/suppliers/${supplier.id}` : "/api/suppliers";
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
            isEdit ? "suppliers.updated" : "suppliers.created"
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

      if (responseBody?.error?.code === "SUPPLIER_PHONE_TAKEN") {
        setErrors({
          phone: translate(dictionary, "suppliers.errors.phoneTaken"),
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
        isEdit ? "suppliers.editSupplier" : "suppliers.addSupplier"
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
            form="supplier-form"
            variant="primary"
            isLoading={isSubmitting}
          >
            {translate(dictionary, "common.save")}
          </Button>
        </>
      }
    >
      <form
        id="supplier-form"
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
          label={translate(dictionary, "suppliers.fields.name")}
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
          label={translate(dictionary, "suppliers.fields.phone")}
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
          label={translate(dictionary, "suppliers.fields.contactPerson")}
          name="contactPerson"
          type="text"
          value={form.contactPerson}
          onChange={(event) => update("contactPerson", event.target.value)}
          error={errors.contactPerson}
          disabled={isSubmitting}
        />

        <Input
          label={translate(dictionary, "suppliers.fields.address")}
          name="address"
          type="text"
          value={form.address}
          onChange={(event) => update("address", event.target.value)}
          error={errors.address}
          disabled={isSubmitting}
        />
      </form>
    </Modal>
  );
}