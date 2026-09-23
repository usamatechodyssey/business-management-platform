// components/ui/Tabs.tsx
"use client";

import { useRef, type KeyboardEvent } from "react";

export interface TabItem {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, activeId, onChange }: TabsProps) {
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  function focusTab(id: string) {
    tabRefs.current.get(id)?.focus();
    onChange(id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const isRtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const lastIndex = tabs.length - 1;

    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") nextIndex = isRtl ? index - 1 : index + 1;
    else if (event.key === "ArrowLeft") nextIndex = isRtl ? index + 1 : index - 1;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = lastIndex;

    if (nextIndex === null) return;

    event.preventDefault();
    const wrapped = (nextIndex + tabs.length) % tabs.length;
    const target = tabs[wrapped];
    if (target) focusTab(target.id);
  }

  return (
    // Outer wrapper: border rehta hai fixed, scroll andar hota hai.
    <div className="min-w-0 border-b border-border">
      <div
        role="tablist"
        // overflow-x-auto + scrollbar hide => tabs scroll, page nahi
        className="flex gap-1 overflow-x-auto [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.id, el);
                else tabRefs.current.delete(tab.id);
              }}
              role="tab"
              type="button"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={[
                // shrink-0 => compress nahi honge; whitespace-nowrap => label wrap nahi hoga
                "shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                isActive
                  ? "border-b-2 border-primary text-primary"
                  : "text-text-muted hover:text-foreground",
              ].join(" ")}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}