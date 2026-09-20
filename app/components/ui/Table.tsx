// components/ui/Table.tsx
"use client";

import type { ReactNode } from "react";
import { Loader } from "./Loader";
import { EmptyState } from "./EmptyState";

export interface TableColumn<T> {
  key: keyof T & string;
  header: string;
  align?: "start" | "center" | "end";
  render?: (row: T) => ReactNode;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  getRowId: (row: T) => string;
  isLoading?: boolean;
  emptyMessage?: string;
}

const ALIGN_CLASSES: Record<NonNullable<TableColumn<unknown>["align"]>, string> = {
  start: "text-start",
  center: "text-center",
  end: "text-end",
};

export function Table<T>({
  columns,
  data,
  getRowId,
  isLoading = false,
  emptyMessage = "No records found.",
}: TableProps<T>) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader />
      </div>
    );
  }

  if (data.length === 0) {
    return <EmptyState title={emptyMessage} />;
  }

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-max text-start text-sm">
        <thead className="bg-surface-muted">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={[
                  "px-4 py-3 font-medium text-text-muted",
                  ALIGN_CLASSES[column.align ?? "start"],
                ].join(" ")}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row) => (
            <tr key={getRowId(row)} className="bg-surface hover:bg-surface-muted">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={["px-4 py-3 text-foreground", ALIGN_CLASSES[column.align ?? "start"]].join(" ")}
                >
                  {column.render ? column.render(row) : String(row[column.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}