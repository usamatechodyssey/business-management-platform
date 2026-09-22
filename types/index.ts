// ── Roles & permissions ──────────────────────────────────────────
// Sentinel value for "no limit" in PlanLimits fields. Defined here (a
// client-safe module with zero imports) rather than in lib/plans.ts,
// because client components need this constant but must NOT pull in the
// MongoDB driver that lib/plans.ts depends on.
export const UNLIMITED = -1;
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
   // Undefined = grandfathered (e.g. pre-launch test data). Admin dashboard
  // treats missing subscription as "active indefinitely" until an admin
  // explicitly grants or suspends.
  subscription?: BusinessSubscription;
  suspendedAt?: string;
  suspendedReason?: string;
  deletedAt?: string;
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

// Public-facing view of a user — never includes passwordHash. This is
// what every API response and client component sees.
export type SafeUser = Omit<User, "passwordHash">;
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
  createdAt: string;
}

// ── Sales / POS ────────────────────────────────────────────────────

export interface SaleItem {
  productId: string;
  productName: string;
  qty: number;
  price: number;
    // Snapshot of the product's costPrice at the moment of sale. Used for
  // profit calculation that stays accurate even after the product's cost
  // changes on a later purchase.
  cost: number;
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
   createdAt: string;
   // Frozen at insert time. Contains one entry per enabled fund tier
  // active on the sale's date. Rate changes and tier enable/disable
  // operations never mutate these — historical allocations stay stable.
  profitFundAllocations?: SaleProfitFundAllocation[];
}

export interface SaleProfitFundAllocation {
  tierId: string;
  tierName: string;
  percentage: number;
  amount: number; // rounded rupees; may be negative if profit is negative
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
export interface ProfitFundTierRate {
  id: string;
  businessId: string;
  tierId: string;
  percentage: number;
  // ISO timestamp. Applied from this moment (PKT day) onwards.
  effectiveFrom: string;
  createdAt: string;
}

export interface ProfitFundDisbursement {
  id: string;
  businessId: string;
  tierId: string;
  date: string;
  amount: number;
  note?: string;
  createdAt: string;
}

// ── Reports ──────────────────────────────────────────────────────



export interface ProfitFundBreakdownLine {
  tierId: string;
  tierName: string;
  percentage: number;
  amount: number;
}

// Profit Fund — page-facing summary. Computed server-side and passed to
// the client. Lifetime values are since the business was created.
export interface ProfitFundTierSnapshot extends ProfitFundTier {
  // This range's allocation for this tier (percentage × rangeProfit).
  rangeAllocation: number;
  // Lifetime allocation (percentage × lifetimeProfit).
  lifetimeAllocation: number;
  // Lifetime disbursements recorded against this tier.
  lifetimeDisbursed: number;
  // Lifetime allocation − lifetime disbursed. Can be zero or positive.
  availableBalance: number;
}

export interface ProfitFundSummary {
  range: DashboardRange;
  rangeProfit: number;
  lifetimeProfit: number;
  tiers: ProfitFundTierSnapshot[];
  // Sum across enabled tiers.
  totalRangeAllocation: number;
  totalLifetimeDisbursed: number;
  totalAvailableBalance: number;
}
// ── Reports ──────────────────────────────────────────────────────

export interface TopCustomer {
  customerId: string;
  customerName: string;
  totalSpent: number;
  salesCount: number;
}

// One bar in the trend chart. `label` is either "YYYY-MM-DD" (day bucket)
// or "YYYY-MM" (month bucket) — the client decides presentation based on
// length, so no locale is needed on the server.
export interface TrendPoint {
  label: string;
  sales: number;
  profit: number;
}

export interface ReportSummary {
  range: DashboardRange;
  totalSales: number;
  totalProfit: number;
  salesCount: number;
  profitFundBreakdown: ProfitFundBreakdownLine[];
  netProfitAfterFunds: number;
  topItems: TopItem[];
  topCustomers: TopCustomer[];
  trend: TrendPoint[];
}
// ── Dashboard ─────────────────────────────────────────────────────
//
// Defined here (not in lib/dashboard.ts) so client components can import
// them without pulling in the server-only DB module.

export type RangePreset =
  | "today"
  | "week"
  | "month"
  | "quarter"
  | "halfYear"
  | "year"
  | "custom";

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


// ── Admin (platform operators — not tenant users) ────────────────
//
// Admin accounts live in a separate `adminUsers` collection and are
// authenticated via a separate cookie (`admin_session_token`). They are
// never part of any tenant's `users` list and never carry a businessId.

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  active: boolean;
  createdAt: string;
  lastLogin?: string;
}

export type AdminActionType =
  | "admin.login"
  | "admin.logout"
  | "tenant.suspend"
  | "tenant.activate"
  | "tenant.delete"
  | "tenant.grant"
  | "tenant.impersonate"
  | "tenant.resetOwnerPassword"
  | "payment.verify"
  | "payment.reject"
  | "plan.create"
  | "plan.update"
  | "plan.delete"
  | "platform.settings.update";

export interface AdminAction {
  id: string;
  adminId: string;
  adminName: string;
  type: AdminActionType;
  // Populated for actions that operate on a specific tenant.
  targetBusinessId?: string;
  targetBusinessName?: string;
  // Free-form context (e.g. `{ months: 3 }` for a grant, `{ ip }` for a
  // login). Kept as a flat map so it renders cleanly in the audit log
  // and stays easy to index later.
  metadata?: Record<string, string | number | boolean>;
  createdAt: string;
}

// ── Subscription (admin-managed) ─────────────────────────────────

export type SubscriptionStatus =
  | "trial"
  | "active"
  | "suspended"
  | "expired";



export interface BusinessSubscription {
  status: SubscriptionStatus;
  // Now a free-form slug that references a PlanTier.slug. No longer a
  // union — plans are admin-editable, so the code can't know the full
  // set at compile time.
  plan: string;
  startedAt: string;
  expiresAt: string;
  lastGrantedBy?: string;
  lastGrantedAt?: string;
  notes?: string;
}

// ── Payments (subscription billing) ─────────────────────────────

export type PaymentStatus = "pending" | "verified" | "rejected";
// Renamed from PaymentMethod to avoid colliding with the sales
// PaymentMethod already defined in this file ("cash" | "khata" | ...).
// Semantically different: sales is how a customer pays the business;
// this is how the business pays the platform.
export type BillingMethod = "jazzcash" | "easypaisa" | "bank" | "other";

export interface Payment {
  id: string;
  businessId: string;

  // Denormalized snapshots so the admin dashboard can render the row
  // without joining to `businesses`. Business names rarely change; if
  // they do, historical payments should still show what was true when
  // the payment was recorded.
  businessName: string;
  ownerName: string;
  ownerPhone: string;

  // What the customer is paying for
  plan: string;
  months: number;
  amount: number;   // expected = PRICING[plan] × months
  method: BillingMethod;

  // Customer's submission
  reference: string;         // e.g. "P-A3K9", shown to customer and admin
  transactionId?: string;    // TID from JazzCash/EasyPaisa receipt
  paidAt: string;            // YYYY-MM-DD; date customer says they paid
  notes?: string;            // customer-supplied notes

  // Admin verification (mutated in place when verify/reject happens)
  status: PaymentStatus;
  verifiedBy?: string;       // adminId
  verifiedAt?: string;
  rejectionReason?: string;

  createdAt: string;
}

// ── Subscription plans (admin-managed, dynamic) ──────────────────
//
// Plans are stored in a `planTiers` collection and fully editable from
// the admin console. -1 in a limit field means "unlimited". Zero means
// the resource is not allowed on that plan.

export interface PlanLimits {
  users: number;
  products: number;
  customers: number;
  suppliers: number;
  salesPerMonth: number;
}

export interface PlanTier {
  id: string;
  slug: string;              // used in BusinessSubscription.plan
  name: string;              // display name, admin-editable
  priceMonthly: number;
  description?: string;
  features: string[];        // bullet list shown on comparison page
  limits: PlanLimits;
  displayOrder: number;
  active: boolean;           // inactive plans hidden from customers
  isTrialPlan: boolean;      // exactly one plan should have this true
  createdAt: string;
  updatedAt: string;
}

// ── Platform settings (admin-configured, single-document) ────────
//
// A single document in the `platformSettings` collection holds
// platform-wide configuration that the admin console edits. Fields
// with a null override fall back to locale strings; every other field
// is authoritative.

export interface PlatformSettings {
  id: string; // always "singleton"

  // Trial
  trialEnabled: boolean;
  trialDays: number;
  // Show a warning banner when ≤ this many days remain.
  trialWarningDays: number;

  // Support channels shown on the blocked screen and in bulk WhatsApp.
  supportWhatsApp: string;
  supportEmail: string;

  // Blocked screen text — when null, falls back to locale strings.
  blockedTitleOverride: string | null;
  blockedDescriptionOverride: string | null;

  // Bulk WhatsApp template. Placeholders: {ownerName}, {businessName},
  // {expiryDate}, {renewalUrl}.
  bulkReminderTemplate: string;

  updatedAt: string;
  updatedBy?: string; // adminId
}