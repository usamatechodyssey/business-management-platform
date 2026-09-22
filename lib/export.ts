// lib/export.ts
//
// Row fetch + mapping for every data-export type. All queries are scoped
// by businessId — a tenant can only ever export its own data. Each
// function returns at most EXPORT_ROW_LIMIT rows; if the source had more,
// `truncated` is true and the CSV includes a note.

import { getDb } from "@/lib/db";
import { resolveRange } from "@/lib/dashboard";
import type {
  Customer,
  LedgerEntry,
  Product,
  Sale,
  Supplier,
} from "@/types";

export const EXPORT_ROW_LIMIT = 50_000;

export interface ExportResult<T> {
  rows: T[];
  truncated: boolean;
  total: number;
}

// ── Products ────────────────────────────────────────────────────
// Snapshot — no date range. Archived products are included so the
// owner has a full picture of what they've sold historically.

export interface ProductExportRow {
  name: string;
  code: string;
  category: string;
  unit: string;
  stockQty: number;
  costPrice: number;
  sellPrice: number;
  lowStockThreshold: number | null;
  status: string;
}

export async function exportProducts(
  businessId: string
): Promise<ExportResult<ProductExportRow>> {
  const db = await getDb();
  const collection = db.collection<Product>("products");
  const total = await collection.countDocuments({ businessId });
  const docs = await collection
    .find({ businessId })
    .sort({ name: 1 })
    .limit(EXPORT_ROW_LIMIT)
    .toArray();

  return {
    rows: docs.map((p) => ({
      name: p.name,
      code: p.code,
      category: p.category ?? "",
      unit: p.unit ?? "",
      stockQty: p.stockQty,
      costPrice: p.costPrice,
      sellPrice: p.sellPrice,
      lowStockThreshold: p.lowStockThreshold ?? null,
      status: p.active ? "Active" : "Archived",
    })),
    truncated: total > EXPORT_ROW_LIMIT,
    total,
  };
}

// ── Customers ───────────────────────────────────────────────────

export interface CustomerExportRow {
  name: string;
  phone: string;
  address: string;
  tag: string;
  creditLimit: number | null;
  dueDate: string;
  guarantorName: string;
  guarantorPhone: string;
  totalDue: number;
  notes: string;
  createdAt: string;
}

export async function exportCustomers(
  businessId: string
): Promise<ExportResult<CustomerExportRow>> {
  const db = await getDb();
  const collection = db.collection<Customer>("customers");
  const total = await collection.countDocuments({ businessId });
  const docs = await collection
    .find({ businessId })
    .sort({ name: 1 })
    .limit(EXPORT_ROW_LIMIT)
    .toArray();

  return {
    rows: docs.map((c) => ({
      name: c.name,
      phone: c.phone,
      address: c.address ?? "",
      tag: c.tag ?? "",
      creditLimit: c.creditLimit ?? null,
      dueDate: c.dueDate ?? "",
      guarantorName: c.guarantorName ?? "",
      guarantorPhone: c.guarantorPhone ?? "",
      totalDue: c.totalDue,
      notes: c.notes ?? "",
      createdAt: c.createdAt,
    })),
    truncated: total > EXPORT_ROW_LIMIT,
    total,
  };
}

// ── Suppliers ───────────────────────────────────────────────────

export interface SupplierExportRow {
  name: string;
  phone: string;
  address: string;
  contactPerson: string;
  totalOwed: number;
  createdAt: string;
}

export async function exportSuppliers(
  businessId: string
): Promise<ExportResult<SupplierExportRow>> {
  const db = await getDb();
  const collection = db.collection<Supplier>("suppliers");
  const total = await collection.countDocuments({ businessId });
  const docs = await collection
    .find({ businessId })
    .sort({ name: 1 })
    .limit(EXPORT_ROW_LIMIT)
    .toArray();

  return {
    rows: docs.map((s) => ({
      name: s.name,
      phone: s.phone,
      address: s.address ?? "",
      contactPerson: s.contactPerson ?? "",
      totalOwed: s.totalOwed,
      createdAt: s.createdAt,
    })),
    truncated: total > EXPORT_ROW_LIMIT,
    total,
  };
}

// ── Sales ───────────────────────────────────────────────────────
// Range-based. Caller passes the preset / custom dates; resolveRange
// normalizes them and we trim to YYYY-MM-DD (Sale.date has no time
// component).

export interface SaleExportRow {
  date: string;
  saleId: string;
  customer: string;
  paymentMethod: string;
  itemsCount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  profit: number;
}

export async function exportSales(
  businessId: string,
  preset?: string,
  customFrom?: string,
  customTo?: string
): Promise<ExportResult<SaleExportRow>> {
  const range = resolveRange(preset, customFrom, customTo);
  const fromDate = range.from.slice(0, 10);
  const toDate = range.to.slice(0, 10);

  const db = await getDb();
  const collection = db.collection<Sale>("sales");
  const filter = { businessId, date: { $gte: fromDate, $lte: toDate } };
  const total = await collection.countDocuments(filter);
  const docs = await collection
    .find(filter)
    .sort({ date: -1, createdAt: -1 })
    .limit(EXPORT_ROW_LIMIT)
    .toArray();

  return {
    rows: docs.map((s) => ({
      date: s.date,
      saleId: s.id,
      customer: s.customerName ?? "(walk-in)",
      paymentMethod: s.paymentMethod,
      itemsCount: s.items.reduce((sum, i) => sum + i.qty, 0),
      total: s.total,
      amountPaid: s.amountPaid,
      amountDue: s.amountDue,
      profit: s.profit,
    })),
    truncated: total > EXPORT_ROW_LIMIT,
    total,
  };
}

// ── Ledger (Khata) ──────────────────────────────────────────────

export interface LedgerExportRow {
  date: string;
  customerName: string;
  type: string;
  amount: number;
  note: string;
  balanceAfter: number;
}

export async function exportLedger(
  businessId: string,
  preset?: string,
  customFrom?: string,
  customTo?: string
): Promise<ExportResult<LedgerExportRow>> {
  const range = resolveRange(preset, customFrom, customTo);
  const fromDate = range.from.slice(0, 10);
  const toDate = range.to.slice(0, 10);

  const db = await getDb();
  const collection = db.collection<LedgerEntry>("ledgerEntries");
  const filter = { businessId, date: { $gte: fromDate, $lte: toDate } };
  const total = await collection.countDocuments(filter);
  const docs = await collection
    .find(filter)
    .sort({ date: -1, createdAt: -1 })
    .limit(EXPORT_ROW_LIMIT)
    .toArray();

  // Look up customer names in one pass — only for entries we're actually
  // exporting, so 50 rows means ~50 names max, not the whole collection.
  const customerIds = Array.from(new Set(docs.map((d) => d.customerId)));
  const customers = await db
    .collection<Customer>("customers")
    .find(
      { businessId, id: { $in: customerIds } },
      { projection: { id: 1, name: 1 } }
    )
    .toArray();
  const nameById = new Map(customers.map((c) => [c.id, c.name]));

  return {
    rows: docs.map((e) => ({
      date: e.date,
      customerName: nameById.get(e.customerId) ?? "(unknown)",
      type: e.type,
      amount: e.amount,
      note: e.note ?? "",
      balanceAfter: e.balanceAfter,
    })),
    truncated: total > EXPORT_ROW_LIMIT,
    total,
  };
}