// app/admin/login/AdminLoginForm.tsx
"use client";

import { useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/app/components/ui/Input";
import { Button } from "@/app/components/ui/Button";
import { useToast } from "@/app/components/ui/Toast";
import { translate, type Dictionary } from "@/lib/i18n";

interface AdminLoginFormProps {
  dictionary: Dictionary;
}

export function AdminLoginForm({ dictionary }: AdminLoginFormProps) {
  const router = useRouter();
  const { push: pushToast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (isSubmitting) return;

    setFormError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        router.refresh();
        router.push("/admin");
        return;
      }

      setFormError(translate(dictionary, "admin.login.error"));
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
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold text-foreground">
          {translate(dictionary, "admin.login.title")}
        </h1>
        <p className="mt-0.5 text-sm text-text-muted">
          {translate(dictionary, "admin.login.subtitle")}
        </p>
      </div>

      {formError && (
        <div
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {formError}
        </div>
      )}

      <Input
        label={translate(dictionary, "admin.login.emailLabel")}
        name="email"
        type="email"
        autoComplete="username"
        autoFocus
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        disabled={isSubmitting}
      />

      <Input
        label={translate(dictionary, "admin.login.passwordLabel")}
        name="password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        disabled={isSubmitting}
      />

      <Button
        type="submit"
        variant="primary"
        fullWidth
        isLoading={isSubmitting}
      >
        {translate(dictionary, "admin.login.submit")}
      </Button>
    </form>
  );
}