// app/components/settings/BusinessProfileForm.tsx
"use client";

import { useEffect, useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/app/components/ui/Input";
import { Button } from "@/app/components/ui/Button";
import { useToast } from "@/app/components/ui/Toast";
import { translate, type Dictionary } from "@/lib/i18n";
import type { Business } from "@/types";

interface BusinessProfileFormProps {
  business: Business;
  dictionary: Dictionary;
}

interface FormState {
  name: string;
  ownerName: string;
  phone: string;
  address: string;
}

interface FieldErrors {
  name?: string;
  ownerName?: string;
  phone?: string;
  address?: string;
}

function businessToForm(b: Business): FormState {
  return {
    name: b.name,
    ownerName: b.ownerName,
    phone: b.phone,
    address: b.address ?? "",
  };
}

export function BusinessProfileForm({
  business,
  dictionary,
}: BusinessProfileFormProps) {
  const router = useRouter();
  const { push } = useToast();

  const [form, setForm] = useState<FormState>(businessToForm(business));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when the business prop changes (e.g. after a successful
  // save the page refreshes and passes the new business down).
  useEffect(() => {
    setForm(businessToForm(business));
    setErrors({});
    setFormError(null);
  }, [business]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};

    const name = form.name.trim();
    if (!name) {
      next.name = translate(dictionary, "settings.errors.nameRequired");
    } else if (name.length > 100) {
      next.name = translate(dictionary, "settings.errors.nameMax");
    }

    const ownerName = form.ownerName.trim();
    if (!ownerName) {
      next.ownerName = translate(dictionary, "settings.errors.ownerNameRequired");
    } else if (ownerName.length > 100) {
      next.ownerName = translate(dictionary, "settings.errors.ownerNameMax");
    }

    const phone = form.phone.trim();
    if (!phone) {
      next.phone = translate(dictionary, "settings.errors.phoneRequired");
    } else if (phone.length < 10) {
      next.phone = translate(dictionary, "settings.errors.phoneMin");
    } else if (phone.length > 20) {
      next.phone = translate(dictionary, "settings.errors.phoneMax");
    }

    if (form.address.length > 200) {
      next.address = translate(dictionary, "settings.errors.addressMax");
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
      const response = await fetch(`/api/businesses/${business.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          ownerName: form.ownerName.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
        }),
      });

      if (response.ok) {
        push({
          message: translate(dictionary, "settings.saved"),
          variant: "success",
        });
        router.refresh();
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
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {formError && (
        <div
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {formError}
        </div>
      )}

      <Input
        label={translate(dictionary, "settings.profile.nameLabel")}
        name="name"
        type="text"
        value={form.name}
        onChange={(event) => update("name", event.target.value)}
        error={errors.name}
        required
        disabled={isSubmitting}
      />

      <Input
        label={translate(dictionary, "settings.profile.ownerNameLabel")}
        name="ownerName"
        type="text"
        value={form.ownerName}
        onChange={(event) => update("ownerName", event.target.value)}
        error={errors.ownerName}
        required
        disabled={isSubmitting}
      />

      <Input
        label={translate(dictionary, "settings.profile.phoneLabel")}
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
        label={translate(dictionary, "settings.profile.addressLabel")}
        name="address"
        type="text"
        value={form.address}
        onChange={(event) => update("address", event.target.value)}
        error={errors.address}
        helperText={translate(dictionary, "settings.profile.addressHelper")}
        disabled={isSubmitting}
      />

      <div className="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
        >
          {translate(dictionary, "settings.save")}
        </Button>
      </div>
    </form>
  );
}