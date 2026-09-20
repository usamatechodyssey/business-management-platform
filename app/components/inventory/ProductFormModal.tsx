// app/components/inventory/ProductFormModal.tsx
"use client";

import { useEffect, useState, type SubmitEvent } from "react";
import { Modal } from "@/app/components/ui/Modal";
import { Input } from "@/app/components/ui/Input";
import { Button } from "@/app/components/ui/Button";
import { useToast } from "@/app/components/ui/Toast";
import { translate, type Dictionary } from "@/lib/i18n";
import type { Product } from "@/types";

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  // null → create mode. Non-null → edit mode.
  product: Product | null;
  dictionary: Dictionary;
  // Called after a successful create/update, before the parent closes the
  // modal — parent is responsible for router.refresh() + closing.
  onSuccess: () => void;
}

interface FormState {
  name: string;
  code: string;
  category: string;
  unit: string;
  stockQty: string;
  costPrice: string;
  sellPrice: string;
  lowStockThreshold: string;
}

interface FieldErrors {
  name?: string;
  code?: string;
  category?: string;
  unit?: string;
  stockQty?: string;
  costPrice?: string;
  sellPrice?: string;
  lowStockThreshold?: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  code: "",
  category: "",
  unit: "",
  stockQty: "0",
  costPrice: "0",
  sellPrice: "0",
  lowStockThreshold: "",
};

function productToForm(p: Product): FormState {
  return {
    name: p.name,
    code: p.code,
    category: p.category ?? "",
    unit: p.unit ?? "",
    stockQty: String(p.stockQty),
    costPrice: String(p.costPrice),
    sellPrice: String(p.sellPrice),
    lowStockThreshold:
      p.lowStockThreshold !== undefined ? String(p.lowStockThreshold) : "",
  };
}

// Returns the numeric value, or undefined for an empty field. Non-numeric
// text returns NaN so validators can distinguish "empty" from "invalid".
function parseNumericField(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  return Number(trimmed);
}

function validate(form: FormState, dictionary: Dictionary): FieldErrors {
  const errors: FieldErrors = {};

  const name = form.name.trim();
  if (!name) {
    errors.name = translate(dictionary, "inventory.errors.nameRequired");
  } else if (name.length > 100) {
    errors.name = translate(dictionary, "inventory.errors.nameMax");
  }

  const code = form.code.trim();
  if (!code) {
    errors.code = translate(dictionary, "inventory.errors.codeRequired");
  } else if (code.length > 50) {
    errors.code = translate(dictionary, "inventory.errors.codeMax");
  }

  if (form.category.length > 50) {
    errors.category = translate(dictionary, "inventory.errors.categoryMax");
  }
  if (form.unit.length > 20) {
    errors.unit = translate(dictionary, "inventory.errors.unitMax");
  }

  const stock = parseNumericField(form.stockQty);
  if (stock === undefined || Number.isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
    errors.stockQty = translate(dictionary, "inventory.errors.stockQtyInvalid");
  }

  const cost = parseNumericField(form.costPrice);
  if (cost === undefined || Number.isNaN(cost) || cost < 0) {
    errors.costPrice = translate(dictionary, "inventory.errors.costPriceInvalid");
  }

  const sell = parseNumericField(form.sellPrice);
  if (sell === undefined || Number.isNaN(sell) || sell < 0) {
    errors.sellPrice = translate(dictionary, "inventory.errors.sellPriceInvalid");
  }

  if (form.lowStockThreshold.trim() !== "") {
    const threshold = parseNumericField(form.lowStockThreshold);
    if (
      threshold === undefined ||
      Number.isNaN(threshold) ||
      threshold < 0 ||
      !Number.isInteger(threshold)
    ) {
      errors.lowStockThreshold = translate(
        dictionary,
        "inventory.errors.lowStockThresholdInvalid"
      );
    }
  }

  return errors;
}

export function ProductFormModal({
  isOpen,
  onClose,
  product,
  dictionary,
  onSuccess,
}: ProductFormModalProps) {
  const { push } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEdit = product !== null;

  // Reset form whenever the modal opens or the target product changes.
  useEffect(() => {
    if (!isOpen) return;
    setForm(product ? productToForm(product) : EMPTY_FORM);
    setErrors({});
    setFormError(null);
  }, [isOpen, product]);

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
      code: form.code.trim(),
      category: form.category.trim(),
      unit: form.unit.trim(),
      stockQty: Number(form.stockQty),
      costPrice: Number(form.costPrice),
      sellPrice: Number(form.sellPrice),
      lowStockThreshold:
        form.lowStockThreshold.trim() === ""
          ? undefined
          : Number(form.lowStockThreshold),
    };

    try {
      const url = isEdit
        ? `/api/products/${product.id}`
        : "/api/products";
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
            isEdit ? "inventory.updated" : "inventory.created"
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

      if (responseBody?.error?.code === "PRODUCT_CODE_TAKEN") {
        setErrors({
          code: translate(dictionary, "inventory.errors.codeTaken"),
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
        isEdit ? "inventory.editProduct" : "inventory.addProduct"
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
            form="product-form"
            variant="primary"
            isLoading={isSubmitting}
          >
            {translate(dictionary, "common.save")}
          </Button>
        </>
      }
    >
      <form
        id="product-form"
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
          label={translate(dictionary, "inventory.fields.name")}
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
          label={translate(dictionary, "inventory.fields.code")}
          name="code"
          type="text"
          value={form.code}
          onChange={(event) => update("code", event.target.value)}
          error={errors.code}
          required
          disabled={isSubmitting}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={translate(dictionary, "inventory.fields.category")}
            name="category"
            type="text"
            value={form.category}
            onChange={(event) => update("category", event.target.value)}
            error={errors.category}
            disabled={isSubmitting}
          />
          <Input
            label={translate(dictionary, "inventory.fields.unit")}
            name="unit"
            type="text"
            value={form.unit}
            onChange={(event) => update("unit", event.target.value)}
            error={errors.unit}
            disabled={isSubmitting}
          />
        </div>

        <Input
          label={translate(dictionary, "inventory.fields.stockQty")}
          name="stockQty"
          type="number"
          inputMode="numeric"
          min={0}
          value={form.stockQty}
          onChange={(event) => update("stockQty", event.target.value)}
          error={errors.stockQty}
          required
          disabled={isSubmitting}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={translate(dictionary, "inventory.fields.costPrice")}
            name="costPrice"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={form.costPrice}
            onChange={(event) => update("costPrice", event.target.value)}
            error={errors.costPrice}
            required
            disabled={isSubmitting}
          />
          <Input
            label={translate(dictionary, "inventory.fields.sellPrice")}
            name="sellPrice"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={form.sellPrice}
            onChange={(event) => update("sellPrice", event.target.value)}
            error={errors.sellPrice}
            required
            disabled={isSubmitting}
          />
        </div>

        <Input
          label={translate(dictionary, "inventory.fields.lowStockThreshold")}
          name="lowStockThreshold"
          type="number"
          inputMode="numeric"
          min={0}
          value={form.lowStockThreshold}
          onChange={(event) => update("lowStockThreshold", event.target.value)}
          error={errors.lowStockThreshold}
          helperText={translate(
            dictionary,
            "inventory.fields.lowStockThresholdHelper"
          )}
          disabled={isSubmitting}
        />
      </form>
    </Modal>
  );
}