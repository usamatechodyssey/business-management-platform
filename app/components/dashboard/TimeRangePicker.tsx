// app/components/dashboard/TimeRangePicker.tsx
"use client";

import { useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { translate, type Dictionary } from "@/lib/i18n";
import type { RangePreset } from "@/types";

interface TimeRangePickerProps {
  preset: RangePreset;
  from?: string;
  to?: string;
  dictionary: Dictionary;
   // Where the picker pushes to on change. Defaults to the dashboard so
  // existing callers don't need updating.
  basePath?: string;
}

const PRESETS: {
  key: RangePreset;
  labelKey:
    | "dashboard.ranges.today"
    | "dashboard.ranges.week"
    | "dashboard.ranges.month"
    | "dashboard.ranges.quarter"
    | "dashboard.ranges.halfYear"
    | "dashboard.ranges.year"
    | "dashboard.ranges.custom";
}[] = [
  { key: "today", labelKey: "dashboard.ranges.today" },
  { key: "week", labelKey: "dashboard.ranges.week" },
  { key: "month", labelKey: "dashboard.ranges.month" },
  { key: "quarter", labelKey: "dashboard.ranges.quarter" },
  { key: "halfYear", labelKey: "dashboard.ranges.halfYear" },
  { key: "year", labelKey: "dashboard.ranges.year" },
  { key: "custom", labelKey: "dashboard.ranges.custom" },
];

export function TimeRangePicker({
  preset,
  from,
  to,
  dictionary,
  basePath = "/dashboard",
}: TimeRangePickerProps) {
  const router = useRouter();
  const [showCustom, setShowCustom] = useState(preset === "custom");
  const [customFrom, setCustomFrom] = useState(from ?? "");
  const [customTo, setCustomTo] = useState(to ?? "");

  function navigate(newPreset: RangePreset, cf?: string, ct?: string) {
    const params = new URLSearchParams();
    params.set("range", newPreset);
    if (newPreset === "custom" && cf && ct) {
      params.set("from", cf);
      params.set("to", ct);
    }
    router.push(`${basePath}?${params.toString()}`);
  }

  function handlePresetClick(key: RangePreset) {
    if (key === "custom") {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    navigate(key);
  }

  function handleCustomSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!customFrom || !customTo) return;
    navigate("custom", customFrom, customTo);
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="group"
        aria-label={translate(dictionary, "dashboard.rangeLabel")}
        className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface p-1"
      >
        {PRESETS.map(({ key, labelKey }) => {
          const isActive = preset === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => handlePresetClick(key)}
              aria-pressed={isActive}
              className={[
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                isActive
                  ? "bg-primary text-white"
                  : "text-text-muted hover:bg-surface-muted",
              ].join(" ")}
            >
              {translate(dictionary, labelKey)}
            </button>
          );
        })}
      </div>

      {showCustom && (
        <form
          onSubmit={handleCustomSubmit}
          className="flex flex-wrap items-end gap-2"
        >
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-muted">
              {translate(dictionary, "dashboard.ranges.from")}
            </span>
            <input
              type="date"
              value={customFrom}
              onChange={(event) => setCustomFrom(event.target.value)}
              className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-muted">
              {translate(dictionary, "dashboard.ranges.to")}
            </span>
            <input
              type="date"
              value={customTo}
              onChange={(event) => setCustomTo(event.target.value)}
              className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </label>
          <button
            type="submit"
            disabled={!customFrom || !customTo}
            className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {translate(dictionary, "dashboard.ranges.apply")}
          </button>
        </form>
      )}
    </div>
  );
}