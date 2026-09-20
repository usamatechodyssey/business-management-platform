// app/components/dashboard/TopItemsList.tsx

import { EmptyState } from "@/app/components/ui/EmptyState";
import { formatCurrency } from "@/lib/format";
import { translate, type Dictionary } from "@/lib/i18n";
import type { TopItem } from "@/types";

interface TopItemsListProps {
  items: TopItem[];
  dictionary: Dictionary;
}

export function TopItemsList({ items, dictionary }: TopItemsListProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <h2 className="mb-3 text-base font-semibold text-foreground">
        {translate(dictionary, "dashboard.topItems")}
      </h2>
      {items.length === 0 ? (
        <EmptyState
          title={translate(dictionary, "dashboard.empty.noSalesTitle")}
          description={translate(dictionary, "dashboard.empty.noSalesDescription")}
        />
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li
              key={item.productId}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {item.productName}
                </p>
                <p className="text-xs text-text-muted">
                  {translate(dictionary, "dashboard.topItemsQty", {
                    count: item.qtySold,
                  })}
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold text-foreground">
                {formatCurrency(item.revenue)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}