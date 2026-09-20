// components/ui/Badge.tsx
type BadgeVariant = "primary" | "success" | "warning" | "danger" | "neutral";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  neutral: "bg-surface-muted text-text-muted",
};

export function Badge({ variant = "neutral", children }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        VARIANT_CLASSES[variant],
      ].join(" ")}
    >
      {children}
    </span>
  );
}