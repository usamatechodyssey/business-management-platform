// app/components/dashboard/MetricCard.tsx

import type { ReactNode } from "react";

type MetricCardVariant = "default" | "success" | "warning" | "danger";

interface MetricCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  variant?: MetricCardVariant;
}

const VARIANT_CLASSES: Record<MetricCardVariant, { border: string; value: string }> = {
  default: { border: "border-border", value: "text-foreground" },
  success: { border: "border-success/30", value: "text-success" },
  warning: { border: "border-warning/30", value: "text-warning" },
  danger: { border: "border-danger/30", value: "text-danger" },
};

export function MetricCard({
  label,
  value,
  hint,
  icon,
  variant = "default",
}: MetricCardProps) {
  const classes = VARIANT_CLASSES[variant];

  return (
    <div
      className={[
        "rounded-xl border bg-surface p-4 shadow-sm",
        classes.border,
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-text-muted">{label}</p>
        {icon && (
          <span className="text-text-muted" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <p className={["mt-2 text-2xl font-semibold", classes.value].join(" ")}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </div>
  );
}