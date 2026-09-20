// app/(auth)/register/RegisterForm.tsx
"use client";

import { useState, type SubmitEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/app/components/ui/Input";
import { Button } from "@/app/components/ui/Button";
import { useToast } from "@/app/components/ui/Toast";
import { translate, type Dictionary } from "@/lib/i18n";

interface RegisterFormProps {
  dictionary: Dictionary;
}

interface RegisterFieldErrors {
  businessName?: string;
  ownerName?: string;
  phone?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

interface RegisterApiError {
  message: string;
  code?: string;
}

function validateRegisterFields(
  values: {
    businessName: string;
    ownerName: string;
    phone: string;
    email: string;
    password: string;
    confirmPassword: string;
  },
  dictionary: Dictionary
): RegisterFieldErrors {
  const errors: RegisterFieldErrors = {};

  const businessName = values.businessName.trim();
  if (businessName.length < 2) {
    errors.businessName = translate(dictionary, "errors.businessNameMin");
  } else if (businessName.length > 100) {
    errors.businessName = translate(dictionary, "errors.businessNameMax");
  }

  const ownerName = values.ownerName.trim();
  if (ownerName.length < 2) {
    errors.ownerName = translate(dictionary, "errors.ownerNameMin");
  } else if (ownerName.length > 100) {
    errors.ownerName = translate(dictionary, "errors.ownerNameMax");
  }

  const phone = values.phone.trim();
  if (phone.length < 10) {
    errors.phone = translate(dictionary, "errors.phoneMin");
  } else if (phone.length > 20) {
    errors.phone = translate(dictionary, "errors.phoneMax");
  }

  const email = values.email.trim();
  if (email !== "") {
    if (email.length > 254) {
      errors.email = translate(dictionary, "errors.emailMax");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = translate(dictionary, "errors.emailInvalid");
    }
  }

  if (values.password.length < 8) {
    errors.password = translate(dictionary, "errors.passwordMin");
  } else if (!/[A-Za-z]/.test(values.password)) {
    errors.password = translate(dictionary, "errors.passwordLetter");
  } else if (!/\d/.test(values.password)) {
    errors.password = translate(dictionary, "errors.passwordNumber");
  }

  if (values.password !== values.confirmPassword) {
    errors.confirmPassword = translate(dictionary, "errors.passwordMismatch");
  }

  return errors;
}

export function RegisterForm({ dictionary }: RegisterFormProps) {
  const router = useRouter();
  const { push: pushToast } = useToast();

  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (isSubmitting) return;

    setFormError(null);
    setFieldErrors({});

    const validationErrors = validateRegisterFields(
      { businessName, ownerName, phone, email, password, confirmPassword },
      dictionary
    );
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, ownerName, phone, email, password }),
      });

      if (response.ok) {
        router.refresh();
        router.push("/dashboard");
        return;
      }

      let payload: { error?: RegisterApiError } | null = null;
      try {
        payload = (await response.json()) as { error?: RegisterApiError };
      } catch {
        payload = null;
      }

      const apiError = payload?.error;

      if (apiError?.code === "PHONE_TAKEN") {
        setFieldErrors({
          phone: translate(dictionary, "errors.phoneTaken"),
        });
        return;
      }
      if (apiError?.code === "EMAIL_TAKEN") {
        setFieldErrors({
          email: translate(dictionary, "errors.emailTaken"),
        });
        return;
      }

      setFormError(translate(dictionary, "errors.generic"));
    } catch {
      pushToast({
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
        label={translate(dictionary, "auth.businessNameLabel")}
        name="businessName"
        type="text"
        autoComplete="organization"
        autoFocus
        required
        value={businessName}
        onChange={(event) => setBusinessName(event.target.value)}
        error={fieldErrors.businessName}
        disabled={isSubmitting}
      />

      <Input
        label={translate(dictionary, "auth.ownerNameLabel")}
        name="ownerName"
        type="text"
        autoComplete="name"
        required
        value={ownerName}
        onChange={(event) => setOwnerName(event.target.value)}
        error={fieldErrors.ownerName}
        disabled={isSubmitting}
      />

      <Input
        label={translate(dictionary, "auth.phoneLabel")}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        error={fieldErrors.phone}
        disabled={isSubmitting}
      />

      <Input
        label={translate(dictionary, "auth.emailLabel")}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={fieldErrors.email}
        helperText={translate(dictionary, "auth.emailHelper")}
        disabled={isSubmitting}
      />

      <Input
        label={translate(dictionary, "auth.passwordLabel")}
        name="password"
        type="password"
        autoComplete="new-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={fieldErrors.password}
        helperText={translate(dictionary, "auth.passwordHint")}
        disabled={isSubmitting}
      />

      <Input
        label={translate(dictionary, "auth.confirmPasswordLabel")}
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        error={fieldErrors.confirmPassword}
        disabled={isSubmitting}
      />

      <Button
        type="submit"
        variant="primary"
        isLoading={isSubmitting}
        fullWidth
      >
        {translate(dictionary, "auth.registerButton")}
      </Button>

      <p className="text-center text-sm text-text-muted">
        {translate(dictionary, "auth.haveAccount")}{" "}
        <Link
          href="/login"
          className="rounded font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {translate(dictionary, "auth.loginLink")}
        </Link>
      </p>
    </form>
  );
}