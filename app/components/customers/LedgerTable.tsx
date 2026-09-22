// app/components/customers/LedgerTable.tsx
//
// Renders a customer's khata history as a table. Uses the shared Table<T>
// generic so styling and empty/loading states stay consistent with
// inventory and suppliers.

"use client";

import { Table, type TableColumn } from "@/app/components/ui/Table";
import { Badge } from "@/app/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { translate, type Dictionary, type Locale } from "@/lib/i18n";
import type { LedgerEntry } from "@/types";

interface LedgerTableProps {
  entries: LedgerEntry[];
  locale: Locale;
  dictionary: Dictionary;
}

export function LedgerTable({ entries, locale, dictionary }: LedgerTableProps) {
  const columns: TableColumn<LedgerEntry>[] = [
    {
      key: "date",
      header: translate(dictionary, "customers.ledger.columns.date"),
      render: (entry) => formatDate(entry.date, locale),
    },
    {
      key: "type",
      header: translate(dictionary, "customers.ledger.columns.type"),
      render: (entry) =>
        entry.type === "sale" ? (
          <Badge variant="primary">
            {translate(dictionary, "customers.ledger.typeSale")}
          </Badge>
        ) : (
          <Badge variant="success">
            {translate(dictionary, "customers.ledger.typePayment")}
          </Badge>
        ),
    },
    {
      key: "amount",
      header: translate(dictionary, "customers.ledger.columns.amount"),
      align: "end",
      render: (entry) => formatCurrency(entry.amount),
    },
    {
      key: "note",
      header: translate(dictionary, "customers.ledger.columns.note"),
      render: (entry) =>
        entry.note ?? <span className="text-text-muted">—</span>,
    },
    {
      key: "balanceAfter",
      header: translate(dictionary, "customers.ledger.columns.balance"),
      align: "end",
      render: (entry) => (
        <span className="font-medium">{formatCurrency(entry.balanceAfter)}</span>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      data={entries}
      getRowId={(entry) => entry.id}
      emptyMessage={translate(dictionary, "customers.ledger.empty.title")}
    />
  );
}