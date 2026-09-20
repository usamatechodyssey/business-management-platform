// components/ui/Input.tsx
"use client";

import { forwardRef, useId, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, helperText, id, required, className, ...rest },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-danger ms-1">*</span>}
      </label>
      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : helperText ? helperId : undefined}
        className={[
          "h-11 rounded-lg border bg-surface px-3 text-base text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          "disabled:cursor-not-allowed disabled:opacity-60",
          error ? "border-danger" : "border-border",
          className ?? "",
        ].join(" ")}
        {...rest}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="text-sm text-text-muted">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});