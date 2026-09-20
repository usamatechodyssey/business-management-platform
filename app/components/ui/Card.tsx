// components/ui/Card.tsx
import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function Card({ title, actions, children, className, ...rest }: CardProps) {
  return (
    <div
      className={["rounded-xl border border-border bg-surface p-4 shadow-sm", className ?? ""].join(" ")}
      {...rest}
    >
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between">
          {title && <h3 className="text-base font-semibold text-foreground">{title}</h3>}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}