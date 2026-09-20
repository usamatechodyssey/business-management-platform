// components/ui/Select.tsx
"use client";

import { forwardRef, useId, type SelectHTMLAttributes } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  helperText?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, placeholder, error, helperText, id, required, className, ...rest },
  ref
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = `${selectId}-error`;
  const helperId = `${selectId}-helper`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-danger ms-1">*</span>}
      </label>
      <select
        ref={ref}
        id={selectId}
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
      >
        {placeholder && (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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