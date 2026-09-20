// app/(auth)/login/LoginForm.tsx
"use client";

import { useState, type SubmitEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/app/components/ui/Input";
import { Button } from "@/app/components/ui/Button";
import { useToast } from "@/app/components/ui/Toast";
import { translate, type Dictionary } from "@/lib/i18n";

interface LoginFormProps {
  dictionary: Dictionary;
}

interface LoginApiError {
  message: string;
  code?: string;
}

export function LoginForm({ dictionary }: LoginFormProps) {
  const router = useRouter();
  const { push: pushToast } = useToast();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      if (response.ok) {
        router.refresh();
        router.push("/dashboard");
        return;
      }

      let payload: { error?: LoginApiError } | null = null;
      try {
        payload = (await response.json()) as { error?: LoginApiError };
      } catch {
        payload = null;
      }

      const apiError = payload?.error;

      // 401 with INVALID_CREDENTIALS — always show the client-side
      // translated message, never the server's English string.
      if (apiError?.code === "INVALID_CREDENTIALS") {
        setFormError(translate(dictionary, "auth.loginError"));
        return;
      }

      // Any other server response (unexpected status, network hiccup) —
      // generic translated message. We never surface raw server text.
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
        label={translate(dictionary, "auth.identifierLabel")}
        name="identifier"
        type="text"
        autoComplete="username"
        autoFocus
        required
        value={identifier}
        onChange={(event) => setIdentifier(event.target.value)}
        disabled={isSubmitting}
      />

      <Input
        label={translate(dictionary, "auth.passwordLabel")}
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
        isLoading={isSubmitting}
        fullWidth
      >
        {translate(dictionary, "auth.loginButton")}
      </Button>

      <p className="text-center text-sm text-text-muted">
        {translate(dictionary, "auth.noAccount")}{" "}
        <Link
          href="/register"
          className="rounded font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {translate(dictionary, "auth.createAccountLink")}
        </Link>
      </p>
    </form>
  );
}