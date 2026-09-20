// ── Roles & permissions ──────────────────────────────────────────

export type UserRole = "owner" | "manager" | "cashier" | "accountant";

export type ModuleKey =
  | "pos"
  | "inventory"
  | "suppliers"
  | "customers"
  | "reports"
  | "profitFund"
  | "staff";

// ── Business (tenant) ────────────────────────────────────────────

export interface KhataSettings {
  creditLimitEnabled: boolean;
  defaultCreditLimit: number;
  blockSaleOnLimitExceeded: boolean;
  dueDateTrackingEnabled: boolean;
  defaultPaymentTermsDays: number;
  guarantorEnabled: boolean;
  customerTagsEnabled: boolean;
  allowPartialPayments: boolean;
  requireCustomerPhoneForCredit: boolean;
  reminderTemplateUrdu: string;
  reminderTemplateEnglish: string;
  defaultReminderLanguage: "ur" | "en";
}

export interface BusinessSettings {
  currency: "PKR";
  lowStockThreshold: number;
  language: "en" | "ur";
  khataSettings: KhataSettings;
}

export interface Business {
  id: string;
  name: string;
  ownerName: string;
  phone: string;
  address?: string;
  enabledModules: ModuleKey[];
  settings: BusinessSettings;
  createdAt: string;
}

// ── Users / staff ─────────────────────────────────────────────────

export interface User {
  id: string;
  businessId: string;
  name: string;
  email?: string;
  phone: string;
  role: UserRole;
  passwordHash: string;
  active: boolean;
  createdAt: string;
  lastLogin?: string;
}

// ── Products / inventory ─────────────────────────────────────────

export interface Product {
  id: string;
  businessId: string;
  name: string;
  code: string;
  category?: string;
  unit?: string;
  stockQty: number;
  costPrice: number;
  sellPrice: number;
  lowStockThreshold?: number;
  active: boolean;
}

// ── Suppliers / purchasing ────────────────────────────────────────

export interface Supplier {
  id: string;
  businessId: string;
  name: string;
  phone: string;
  address?: string;
  contactPerson?: string;
  totalOwed: number;
  createdAt: string;
}

export interface PurchaseItem {
  productId: string;
  productName: string;
  qty: number;
  cost: number;
}

export interface Purchase {
  id: string;
  businessId: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseItem[];
  date: string;
  totalCost: number;
  paid: boolean;
  amountPaid: number;
  invoiceNo?: string;
  createdAt: string;
}

export interface SupplierPayment {
  id: string;
  businessId: string;
  supplierId: string;
  purchaseId: string;
  amount: number;
  date: string;
  note?: string;
  createdAt: string;
}

// ── Customers / khata ──────────────────────────────────────────────

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  phone: string;
  address?: string;
  totalDue: number;
  creditLimit?: number;
  dueDate?: string;
  guarantorName?: string;
  guarantorPhone?: string;
  tag?: string;
  notes?: string;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  businessId: string;
  customerId: string;
  type: "sale" | "payment";
  amount: number;
  date: string;
  note?: string;
  balanceAfter: number;
}

// ── Sales / POS ────────────────────────────────────────────────────

export interface SaleItem {
  productId: string;
  productName: string;
  qty: number;
  price: number;
}

export type PaymentMethod = "cash" | "khata" | "online" | "partial";

export interface Sale {
  id: string;
  businessId: string;
  customerId?: string;
  customerName?: string;
  items: SaleItem[];
  date: string;
  total: number;
  amountPaid: number;
  amountDue: number;
  profit: number;
  paymentMethod: PaymentMethod;
}

// ── Profit Fund (generalized Barkat Khana) ─────────────────────────

export interface ProfitFundTier {
  id: string;
  businessId: string;
  name: string;         // fully user-defined — no hardcoded/default value anywhere
  percentage: number;   // user-set, 0–100
  enabled: boolean;
  createdAt: string;
}

export interface ProfitFundDisbursement {
  id: string;
  businessId: string;
  tierId: string;
  date: string;
  amount: number;
  note?: string;
}

// ── Reports ──────────────────────────────────────────────────────

export type ReportPeriod = "daily" | "weekly" | "monthly" | "yearly";

export interface ProfitFundBreakdownLine {
  tierId: string;
  tierName: string;
  percentage: number;
  amount: number;
}

export interface ReportSummary {
  period: ReportPeriod;
  from: string;
  to: string;
  totalSales: number;
  totalProfit: number;
  profitFundBreakdown: ProfitFundBreakdownLine[];
  netProfitAfterFunds: number;
}
// ── Dashboard ─────────────────────────────────────────────────────
//
// Defined here (not in lib/dashboard.ts) so client components can import
// them without pulling in the server-only DB module.

export type RangePreset = "today" | "week" | "month" | "year" | "custom";

export interface DashboardRange {
  preset: RangePreset;
  from: string; // ISO 8601 UTC
  to: string;   // ISO 8601 UTC
}

export interface TopItem {
  productId: string;
  productName: string;
  qtySold: number;
  revenue: number;
}

export interface DashboardSummary {
  range: DashboardRange;
  metrics: {
    totalSales: number;
    totalProfit: number;
    salesCount: number;
    totalReceivables: number;
    customersWithDue: number;
    lowStockCount: number;
    productsCount: number;
  };
  topItems: TopItem[];
}