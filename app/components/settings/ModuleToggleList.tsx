// app/components/settings/ModuleToggleList.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/ui/Button";
import { useToast } from "@/app/components/ui/Toast";
import {
  translate,
  type Dictionary,
  type TranslationKey,
} from "@/lib/i18n";
import type { ModuleKey } from "@/types";

interface ModuleToggleListProps {
  enabledModules: ModuleKey[];
  dictionary: Dictionary;
}

// Order chosen for a natural left-to-right reading of how a shopkeeper
// thinks about the app: sales → stock → buy → sell → analyse → save → team.
const MODULE_ORDER: ModuleKey[] = [
  "pos",
  "inventory",
  "suppliers",
  "customers",
  "reports",
  "profitFund",
  "staff",
];

const MODULE_LABEL_KEY: Record<ModuleKey, TranslationKey> = {
  pos: "settings.modules.labels.pos",
  inventory: "settings.modules.labels.inventory",
  suppliers: "settings.modules.labels.suppliers",
  customers: "settings.modules.labels.customers",
  reports: "settings.modules.labels.reports",
  profitFund: "settings.modules.labels.profitFund",
  staff: "settings.modules.labels.staff",
};

const MODULE_DESC_KEY: Record<ModuleKey, TranslationKey> = {
  pos: "settings.modules.descriptions.pos",
  inventory: "settings.modules.descriptions.inventory",
  suppliers: "settings.modules.descriptions.suppliers",
  customers: "settings.modules.descriptions.customers",
  reports: "settings.modules.descriptions.reports",
  profitFund: "settings.modules.descriptions.profitFund",
  staff: "settings.modules.descriptions.staff",
};

export function ModuleToggleList({
  enabledModules,
  dictionary,
}: ModuleToggleListProps) {
  const router = useRouter();
  const { push } = useToast();

  const [selected, setSelected] = useState<Set<ModuleKey>>(
    new Set(enabledModules)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset when the server sends a fresh business (post-refresh).
  useEffect(() => {
    setSelected(new Set(enabledModules));
  }, [enabledModules]);

  function toggle(module: ModuleKey) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(module)) next.delete(module);
      else next.add(module);
      return next;
    });
  }

  function enableAll() {
    setSelected(new Set(MODULE_ORDER));
  }

  function disableAll() {
    setSelected(new Set());
  }

  async function handleSave() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Preserve the canonical order on the way out so stored arrays are
      // deterministic regardless of click order.
      const ordered = MODULE_ORDER.filter((m) => selected.has(m));

      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabledModules: ordered }),
      });

      if (!response.ok) throw new Error("Save failed");

      push({
        message: translate(dictionary, "settings.saved"),
        variant: "success",
      });
      router.refresh();
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
    <div className="flex flex-col gap-4">
      {/* Bulk actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={enableAll}
          disabled={isSubmitting}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {translate(dictionary, "settings.modules.enableAll")}
        </button>
        <button
          type="button"
          onClick={disableAll}
          disabled={isSubmitting}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {translate(dictionary, "settings.modules.disableAll")}
        </button>
      </div>

      {/* Module list */}
      <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
        {MODULE_ORDER.map((module) => {
          const isOn = selected.has(module);
          return (
            <li key={module}>
              <label className="flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-muted">
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() => toggle(module)}
                  disabled={isSubmitting}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {translate(dictionary, MODULE_LABEL_KEY[module])}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {translate(dictionary, MODULE_DESC_KEY[module])}
                  </p>
                </div>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="primary"
          onClick={handleSave}
          isLoading={isSubmitting}
        >
          {translate(dictionary, "settings.save")}
        </Button>
      </div>
    </div>
  );
}