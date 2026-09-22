// lib/db-indexes.ts
//
// Centralized index definitions for every collection. Indexes are the
// single biggest performance lever in MongoDB — without them, every
// query does a full collection scan. Fine at 100 docs, unusable at
// 100,000.
//
// Every index below maps to a specific query pattern that exists in the
// codebase. No speculative indexes: if you can't point to a query that
// uses it, don't add it here.
//
// `ensureIndexes()` is idempotent — MongoDB ignores "index already
// exists with same spec" and only errors when the spec differs
// (IndexOptionsConflict, code 85). We log-and-continue on conflict so
// a single stale index can't block startup, but we re-throw any other
// error (permissions, network) so real problems surface.

import type { Db, IndexSpecification, CreateIndexesOptions } from "mongodb";

interface IndexDefinition {
  collection: string;
  keys: IndexSpecification;
  options?: CreateIndexesOptions;
}

// ── Index definitions ──────────────────────────────────────────

const INDEXES: readonly IndexDefinition[] = [
  // ── businesses ────────────────────────────────────────────
  // Looked up by app-level UUID on every authenticated request:
  // app/(dashboard)/layout.tsx, /api/settings, /api/businesses/[id].
  {
    collection: "businesses",
    keys: { id: 1 },
    options: { unique: true, name: "businesses_id_unique" },
  },

  // ── users ─────────────────────────────────────────────────
  // Staff detail lookups (GET/PATCH/DELETE /api/users/[id]).
  {
    collection: "users",
    keys: { id: 1 },
    options: { unique: true, name: "users_id_unique" },
  },
  // Login query: findOne({ $or: [{ phone }, { email }], active: true }).
  // Both identifiers are globally unique; separate unique indexes let
  // MongoDB resolve the $or as two index scans.
  {
    collection: "users",
    keys: { phone: 1 },
    options: { unique: true, name: "users_phone_unique" },
  },
  {
    collection: "users",
    keys: { email: 1 },
    options: {
      unique: true,
      name: "users_email_unique",
      // Partial: not every user has an email. A partial index only
      // covers docs where `email` exists, saving space and preventing
      // a phantom-collision on missing values.
      partialFilterExpression: { email: { $exists: true } },
    },
  },
  // Staff list per tenant, sorted by name (listStaff()).
  {
    collection: "users",
    keys: { businessId: 1, name: 1 },
    options: { name: "users_business_name" },
  },

  // ── products ──────────────────────────────────────────────
  {
    collection: "products",
    keys: { id: 1 },
    options: { unique: true, name: "products_id_unique" },
  },
  // Inventory list: filter by business + active, sort by name.
  {
    collection: "products",
    keys: { businessId: 1, active: 1, name: 1 },
    options: { name: "products_business_active_name" },
  },
  // Product-code uniqueness is per-tenant (isProductCodeTaken()).
  {
    collection: "products",
    keys: { businessId: 1, code: 1 },
    options: { unique: true, name: "products_business_code_unique" },
  },

  // ── suppliers ─────────────────────────────────────────────
  {
    collection: "suppliers",
    keys: { id: 1 },
    options: { unique: true, name: "suppliers_id_unique" },
  },
  {
    collection: "suppliers",
    keys: { businessId: 1, phone: 1 },
    options: { unique: true, name: "suppliers_business_phone_unique" },
  },
  {
    collection: "suppliers",
    keys: { businessId: 1, name: 1 },
    options: { name: "suppliers_business_name" },
  },

  // ── purchases ─────────────────────────────────────────────
  {
    collection: "purchases",
    keys: { id: 1 },
    options: { unique: true, name: "purchases_id_unique" },
  },
  // Purchases list per supplier (PurchasesListModal).
  {
    collection: "purchases",
    keys: { businessId: 1, supplierId: 1, date: -1, createdAt: -1 },
    options: { name: "purchases_business_supplier_date" },
  },

  // ── supplierPayments ──────────────────────────────────────
  {
    collection: "supplierPayments",
    keys: { id: 1 },
    options: { unique: true, name: "supplierPayments_id_unique" },
  },
  {
    collection: "supplierPayments",
    keys: { businessId: 1, supplierId: 1, date: -1, createdAt: -1 },
    options: { name: "supplierPayments_business_supplier_date" },
  },
  // Per-purchase audit trail.
  {
    collection: "supplierPayments",
    keys: { purchaseId: 1 },
    options: { name: "supplierPayments_purchase" },
  },

  // ── customers ─────────────────────────────────────────────
  {
    collection: "customers",
    keys: { id: 1 },
    options: { unique: true, name: "customers_id_unique" },
  },
  {
    collection: "customers",
    keys: { businessId: 1, phone: 1 },
    options: { unique: true, name: "customers_business_phone_unique" },
  },
  {
    collection: "customers",
    keys: { businessId: 1, name: 1 },
    options: { name: "customers_business_name" },
  },

  // ── ledgerEntries ─────────────────────────────────────────
  {
    collection: "ledgerEntries",
    keys: { id: 1 },
    options: { unique: true, name: "ledgerEntries_id_unique" },
  },
  // Ledger view: filter by business + customer, sort by date desc.
  {
    collection: "ledgerEntries",
    keys: { businessId: 1, customerId: 1, date: -1, createdAt: -1 },
    options: { name: "ledgerEntries_business_customer_date" },
  },

  // ── sales ─────────────────────────────────────────────────
  {
    collection: "sales",
    keys: { id: 1 },
    options: { unique: true, name: "sales_id_unique" },
  },
  // Dashboard + reports aggregations: business + date range, sort by date.
  {
    collection: "sales",
    keys: { businessId: 1, date: -1, createdAt: -1 },
    options: { name: "sales_business_date" },
  },
  // Customer-scoped sales (top customers, customer history lookups).
  {
    collection: "sales",
    keys: { businessId: 1, customerId: 1, date: -1 },
    options: { name: "sales_business_customer_date" },
  },

  // ── profitFundTiers ───────────────────────────────────────
  {
    collection: "profitFundTiers",
    keys: { id: 1 },
    options: { unique: true, name: "profitFundTiers_id_unique" },
  },
  {
    collection: "profitFundTiers",
    keys: { businessId: 1, createdAt: 1 },
    options: { name: "profitFundTiers_business_created" },
  },
  // Tier-name uniqueness per tenant (isTierNameTaken()).
  {
    collection: "profitFundTiers",
    keys: { businessId: 1, name: 1 },
    options: { unique: true, name: "profitFundTiers_business_name_unique" },
  },

  // ── profitFundDisbursements ───────────────────────────────
  {
    collection: "profitFundDisbursements",
    keys: { id: 1 },
    options: { unique: true, name: "profitFundDisbursements_id_unique" },
  },
  {
    collection: "profitFundDisbursements",
    keys: { businessId: 1, tierId: 1, date: -1, createdAt: -1 },
    options: { name: "profitFundDisbursements_business_tier_date" },
  },
    // ── adminUsers ────────────────────────────────────────────
  {
    collection: "adminUsers",
    keys: { id: 1 },
    options: { unique: true, name: "adminUsers_id_unique" },
  },
  {
    collection: "adminUsers",
    keys: { email: 1 },
    options: { unique: true, name: "adminUsers_email_unique" },
  },

  // ── adminActions ──────────────────────────────────────────
  // Full audit trail of every admin action. Two indexes: one for
  // "what did admin X do, newest first" and one for "what happened to
  // tenant Y, newest first".
  {
    collection: "adminActions",
    keys: { id: 1 },
    options: { unique: true, name: "adminActions_id_unique" },
  },
  {
    collection: "adminActions",
    keys: { adminId: 1, createdAt: -1 },
    options: { name: "adminActions_admin_created" },
  },
  {
    collection: "adminActions",
    keys: { targetBusinessId: 1, createdAt: -1 },
    options: { name: "adminActions_target_created" },
  },
    // ── payments ──────────────────────────────────────────────
  {
    collection: "payments",
    keys: { id: 1 },
    options: { unique: true, name: "payments_id_unique" },
  },
  // Reference must be globally unique — it's how a customer and admin
  // recognise the same payment in WhatsApp.
  {
    collection: "payments",
    keys: { reference: 1 },
    options: { unique: true, name: "payments_reference_unique" },
  },
  // Admin dashboard: list pending payments newest-first.
  {
    collection: "payments",
    keys: { status: 1, createdAt: -1 },
    options: { name: "payments_status_created" },
  },
  // Business billing page: that tenant's own payment history.
  {
    collection: "payments",
    keys: { businessId: 1, createdAt: -1 },
    options: { name: "payments_business_created" },
  },
    // ── planTiers ────────────────────────────────────────────
  {
    collection: "planTiers",
    keys: { id: 1 },
    options: { unique: true, name: "planTiers_id_unique" },
  },
  {
    collection: "planTiers",
    keys: { slug: 1 },
    options: { unique: true, name: "planTiers_slug_unique" },
  },
  {
    collection: "planTiers",
    keys: { displayOrder: 1 },
    options: { name: "planTiers_display_order" },
  },
   {
    collection: "platformSettings",
    keys: { id: 1 },
    options: { unique: true, name: "platformSettings_id_unique" },
  },
    // ── profitFundTierRates ─────────────────────────────────────
  {
    collection: "profitFundTierRates",
    keys: { id: 1 },
    options: { unique: true, name: "profitFundTierRates_id_unique" },
  },
  {
    collection: "profitFundTierRates",
    keys: { businessId: 1, tierId: 1, effectiveFrom: 1 },
    options: { name: "profitFundTierRates_business_tier_from" },
  },
];


// ── Public API ──────────────────────────────────────────────────

// Creates every index defined above. Idempotent: MongoDB ignores
// existing-index-with-same-spec, so this can be called on every cold
// start without side effects. Logs once per process when it finishes.
export async function ensureIndexes(db: Db): Promise<void> {
  const started = Date.now();
  let created = 0;
  let skipped = 0;

  for (const def of INDEXES) {
    try {
      await db.collection(def.collection).createIndex(def.keys, def.options);
      created += 1;
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code === 85) {
        // IndexOptionsConflict — an index with this name already exists
        // but with different options. Log and move on; a stale index
        // shouldn't block the app from booting. A human should resolve
        // the mismatch manually.
        console.warn(
          `[db-indexes] Conflict on ${def.collection} "${
            def.options?.name ?? "unnamed"
          }": ${(err as Error).message}`
        );
        skipped += 1;
        continue;
      }
      // Any other failure (auth, network) — surface it. The caller
      // (lib/db.ts) memoizes this promise, so a failed boot retries on
      // the next cold start rather than silently disabling indexes.
      throw err;
    }
  }

  const elapsed = Date.now() - started;
  console.log(
    `[db-indexes] Ready: ${created} ensured, ${skipped} skipped in ${elapsed}ms`
  );
  
}
