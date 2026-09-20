// components/ui/Button.tsx
"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-dark",
  secondary: "bg-surface text-foreground border border-border hover:bg-surface-muted",
  danger: "bg-danger text-white hover:opacity-90",
  ghost: "bg-transparent text-foreground hover:bg-surface-muted",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-4 text-base gap-2",
  lg: "h-12 px-5 text-base gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    isLoading = false,
    fullWidth = false,
    leadingIcon,
    trailingIcon,
    disabled,
    children,
    className,
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={[
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-60",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth ? "w-full" : "",
        className ?? "",
      ].join(" ")}
      aria-busy={isLoading}
      {...rest}
    >
      {isLoading ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : (
        leadingIcon
      )}
      {children}
      {!isLoading && trailingIcon}
    </button>
  );
});