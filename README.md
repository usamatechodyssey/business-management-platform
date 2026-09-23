# Business Management Platform

> A multi-tenant, bilingual (English / اردو), mobile-first business management system — purpose-built for Pakistani retail & wholesale businesses, delivered as a fully self-serve SaaS.

**Status:** ✅ Feature-complete. Ready for deployment.

---

## Overview

Business Management Platform (BMP) is a cloud-based, multi-tenant SaaS that consolidates a small or medium retail/wholesale business's day-to-day operations into a single, mobile-friendly web app. It also ships a separate **platform admin console** so the operator can manage tenants, plans, payments, and subscriptions without touching the database.

### Business-facing features

- **Point of Sale (POS)** — fast checkout, four payment methods (cash, khata, online, partial), printable receipts
- **Real-time inventory** — products, stock levels, cost/sell prices, low-stock alerts
- **Supplier & purchasing** — vendor profiles, purchase records, payment tracking
- **Customer khata** — digital ledger per customer with credit limits, due dates, guarantors, tags
- **Sales, profit & trend reporting** — time-range analytics with top items and top customers
- **Profit Fund** — fully user-configurable multi-tier profit allocation with an immutable rate history, per-period ledger, running balance, and CSV/PDF export
- **WhatsApp reminders** — one-tap khata reminders via `wa.me` deep links (no Meta Business API approval needed)
- **Staff management** — invite staff, assign roles, enable/disable access
- **Business settings** — profile, module toggles, khata rules, reminder templates, language
- **Billing & subscription** — self-serve renewal with plan comparison, manual payment submission, WhatsApp receipt delivery, payment history
- **Data export** — CSV download (Products, Customers, Suppliers, Sales, Khata Ledger, Tier Ledger) plus print/PDF-ready reports

### Platform admin console (separate auth)

- **Tenants list** with search, subscription-status filters (trial / active / expired / suspended), signup-date filters, and an "expiring soon" toggle
- **Tenant detail** — usage counts, subscription state, and actions: suspend, activate, grant/renew, reset owner password, impersonate owner
- **Bulk WhatsApp reminders** — filter tenants, select any number, walk through a WhatsApp-guided send loop with a customizable message template
- **Dynamic plans** — create, edit, and delete subscription tiers with pricing, features, and per-resource limits (users, products, customers, suppliers, sales/month). No hardcoded prices anywhere
- **Payments inbox** — verify or reject submitted payments; verification atomically grants the subscription
- **Platform settings** — trial length, warning threshold, support channels, blocked-screen text overrides, bulk-WhatsApp template
- **Audit log** — every admin action recorded with timestamp, actor, target tenant, and metadata

The product works seamlessly on **mobile, tablet, laptop, and desktop** from a single codebase, with **no app-store installation required**.

---

## Core Principles

1. **Multi-tenant from day one** — every business-owned document carries a `businessId`; a single shared database serves all tenants. Cross-tenant access returns 404, never 403 (no existence leak).
2. **Modular feature flags** — each tenant's `Business` record declares its `enabledModules`; the sidebar, bottom nav, and API are filtered accordingly.
3. **Role-based access control** — four business roles (`owner`, `manager`, `cashier`, `accountant`) with a granular permission matrix enforced both in the UI and in every API route. Plus a completely separate `admin` identity for the platform operator.
4. **Bilingual, RTL-aware** — full English + Urdu support with cookie-based locale switching. No URL prefix — layout flips via logical CSS properties (`ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`), so the same markup works in both directions.
5. **Config over hardcoding** — nothing business-specific (currency, thresholds, fund tier names, percentages, reminder templates, plan pricing, plan features, plan limits, trial length, support channels) is hardcoded; all is admin- or owner-editable at runtime.
6. **Type safety enforced at build time** — strict TypeScript (`noUncheckedIndexedAccess`, `noImplicitReturns`, `forceConsistentCasingInFileNames`), no `any`, no dead code, no unused imports. These are enforced by the build, not just convention.
7. **Currency is always `Rs`** (Pakistani Rupee) — every amount flows through `lib/format.ts → formatCurrency()`. Never `$`.
8. **Immutable history** — Profit Fund allocations are snapshotted onto each sale, rate changes append a new row instead of overwriting, and purchase costs are frozen on `SaleItem.cost`. Historical numbers never drift.
9. **No server state is trusted from the client** — all business-rule validation (stock availability, credit limits, payment amounts, plan limits, owner protection) runs server-side, money-affecting flows inside MongoDB transactions. Client validation is a UX affordance only.
10. **No surprise lockouts** — a lapsed tenant sees the exact reason and a clear "Renew" CTA, and `/billing` (plus its APIs) stays reachable so they can self-recover.
11. **Single-responsibility auth** — the business session cookie (`session_token`) and the admin session cookie (`admin_session_token`) are cryptographically distinct and independently verifiable. A logged-in shopkeeper can never gain admin access by accident.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) | Server Components, streaming, typed routes |
| UI Runtime | React 19 | Modern hooks, `SubmitEvent`, no legacy patterns |
| Language | TypeScript (strict) | Type safety at build time, no `any` |
| Styling | Tailwind CSS v4 | CSS-variable design tokens, logical properties for RTL |
| Database | MongoDB Atlas (native driver) | Multi-document transactions on free tier (replica set) |
| Auth | `jose` + `bcryptjs` | `jose` works on Edge runtime (`proxy.ts`); bcrypt for password hashing |
| Validation | `zod` | Server-side request validation with typed schemas |
| Date handling | `date-fns` | Locale-aware date rendering |
| Icons | `lucide-react` | Tree-shakeable, TypeScript-first |
| Fonts | Geist Sans, Geist Mono, Noto Nastaliq Urdu | Latin + Urdu typography |
| Deployment | Vercel | Serverless, native Next.js |

---

## Architecture Highlights

### Authentication & sessions
- Two independent session systems:
  - **Business** — cookie `session_token`, JWT payload `{ userId, businessId, role, name }`, 7-day expiry.
  - **Admin** — cookie `admin_session_token`, JWT payload `{ adminId, email, name }`, separate `adminUsers` collection.
- Both signed/verified with `jose` (HS256) so the same code works on Edge (`proxy.ts`) and Node (API routes).
- The admin JWT uses `ADMIN_JWT_SECRET` if set, otherwise derives from `JWT_SECRET + ":admin"` — cryptographically incompatible with the business secret even when the env var is shared.
- `proxy.ts` gates every non-API route — unauthenticated users go to `/login`, logged-in users are bounced away from `/login` / `/register`, and admin routes are gated independently at `/admin/login`.

### Tenant isolation
- `lib/tenant.ts` exports `getTenantContext()` (throws, for Server Components) and `requireTenant()` (discriminated union, for API routes).
- `lib/subscription-guard.ts` adds `requireActiveTenant()` — same shape but also blocks if the subscription has lapsed. Money-affecting mutations use this.
- Every Mongo query is scoped by `businessId`; every insert is stamped with it.
- Cross-tenant id lookups return 404, never 403 — the app never confirms that another tenant's record exists.

### Multi-document transactions
Money-affecting flows run inside MongoDB transactions via `lib/mongo-transaction.ts`:
- **Sale creation** — stock decrement + sale insert + (for khata/partial) customer `totalDue` update + ledger entry + Profit Fund allocation snapshots.
- **Purchase creation** — stock increment + cost price update + purchase insert + supplier owed update + optional initial payment row.
- **Supplier payment** — purchase `amountPaid` + supplier `totalOwed` + audit row.
- **Customer khata payment** — customer `totalDue` + ledger entry.
- **Payment verification** — payment status + subscription extension in one atomic step. Extends from the *existing* expiry (not "today"), so mid-cycle grants don't cut off remaining days.
- **Tier rate change** — new rate row appended + tier's cached percentage updated atomically.
- **Tier deletion** — cascades rate history cleanup in the same transaction.

MongoDB Atlas (all tiers, including free M0) is a replica set, so this works everywhere the app is deployed.

### Dynamic subscription plans
- Plans live in a `planTiers` collection, seeded with defaults on first read.
- Each plan has a `slug`, display name, monthly price, feature bullets, and per-resource `limits` object (`users`, `products`, `customers`, `suppliers`, `salesPerMonth`; `-1` means unlimited).
- The admin console fully CRUDs these — including the "trial" plan's name and limits (only the slug is locked).
- **Plan limits are enforced** at the API layer via `lib/limits.ts` — creating a 501st product on a Basic plan returns 403 `LIMIT_REACHED`. Counts are indexed, so the check is O(log n).
- The customer-facing `/billing/plans` comparison page is generated entirely from this collection.

### Trial lifecycle
- On register, if the platform's `trialEnabled` flag is true, the new business receives a subscription with `status: "trial"` and `expiresAt = now + platform.trialDays`. Length is admin-configurable and applies to *future* signups only.
- Dashboard layout blocks lapsed tenants (expired, suspended, or past-due date) with a full-screen `SubscriptionBlocked` component — except on `/billing*`, which uses a separate route group (`app/(billing)/`) so the sidebar swaps correctly during client navigation.
- A yellow warning banner appears when `daysLeft ≤ platform.trialWarningDays`.
- The blocked screen's buttons and text pull from `platformSettings` (support WhatsApp / email, title and description overrides).
- `/api/products`, `/api/customers`, `/api/suppliers`, `/api/users`, `/api/sales` all reject mutations with 403 `SUBSCRIPTION_LAPSED` when the tenant has lapsed. Reads stay open so billing pages function.

### Type-safe i18n
- The `Dictionary` type is derived from `locales/en.json`. `ur.json` must structurally match or the **build fails** — translations can never silently go missing.
- `TranslationKey` is a recursive dot-path union. Typos and missing keys are compile-time errors.
- Locale is stored in a cookie (`locale`, 1-year expiry), not in the URL. Keeps `proxy.ts` matcher logic untouched and makes every page shareable across languages.
- `lib/i18n.ts` is pure (no `next/headers`) so Client Components can import `translate` safely. The server-only `getLocale()` lives in `lib/i18n-server.ts`; the Server Action `setLocale()` lives in `lib/i18n-actions.ts` (whole-file `"use server"`).

### RTL support
- `<html lang={locale} dir={getDirection(locale)}>` set dynamically per request.
- `globals.css` switches the body font to Noto Nastaliq Urdu under `html[dir="rtl"]` and bumps line-height to 2.4 so descenders don't clip.
- All shared components use **logical** Tailwind properties (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`). No per-component RTL branching.
- `Tabs.tsx` checks the computed `direction` at runtime to swap Left/Right arrow-key semantics under Urdu.

### Profit Fund (generalized Barkat Khana)

The original "Barkat Khana" concept is generalized into a fully owner-controlled system with immutable history:

- **Multiple tiers**, each independently named (e.g. "Charity", "Staff Bonus", "Reinvestment").
- **User-set percentages**, no hardcoded name or value anywhere.
- **Rate history is append-only.** Every percentage change writes a new row to `profitFundTierRates` with an `effectiveFrom` timestamp; existing rows are never updated or deleted. The tier's own `percentage` field is a cache of the current rate for fast reads.
- **Allocations are snapshotted on the sale.** When a sale is created, the transaction captures one `SaleProfitFundAllocation` per enabled tier — `{ tierId, tierName, percentage, amount }` — and freezes it on the `Sale` document. Summaries are computed by summing these snapshots, never by re-multiplying rate × profit. This means:
  - Changing a rate today has zero effect on yesterday's allocation.
  - Disabling a tier stops future contributions but leaves past contributions intact.
  - Deleting a tier is blocked while any disbursement exists; if allowed, its rate history is cleaned up in the same transaction.
- **Live calculation display** on the profit-fund page: "Current rate: X%" plus the period's allocated amount.
- **Disbursement tracking.** Each tier shows `availableBalance = lifetimeAllocation − lifetimeDisbursed`. Disbursements are recorded against a tier with a date and optional note.
- **Detailed per-tier ledger.** `/profit-fund/[id]/ledger` shows one row per rate period — profit in that window, allocation (from sale snapshots), disbursements, and a running balance. A tier that earned profit while disabled shows the profit but a Rs 0 allocation, with a "Not active" hint.
- **CSV and PDF export** for the ledger, honoring the same time-range presets as the dashboard. CSV headers are locale-aware (English / Urdu).
- **Reports (M7)** reuse the same snapshot-based math so tier totals never drift between screens.

### Manual payment workflow
- Customer submits a payment via `/billing` with plan, months, method, transaction ID, and date. The server generates a short reference (e.g. `P-BB93`) for WhatsApp use.
- The reference appears in payment history alongside a "Send receipt on WhatsApp" link that opens `wa.me` with a pre-filled message to the platform's support number.
- Admin verifies the payment (with optional reason on rejection). Verification atomically extends the subscription using the same extend-from-expiry rule as a manual grant.
- Rejected payments display the reason on the customer's billing page.
- Max 3 pending payments per tenant — abuse guard.

### Data export
- Six CSV endpoints (products, customers, suppliers, sales, ledger, tier-ledger) — all UTF-8 BOM so Excel renders Urdu correctly. Column headers are translated to the caller's current locale.
- Sales, ledger, and tier-ledger honor the same time-range presets as the dashboard.
- Two print routes:
  - `/print/settings` — full business report (all five core datasets).
  - `/print/tier-ledger/[id]` — single-tier rate-history ledger.
- Both print routes rely on the browser's native "Save as PDF" — no PDF library, no server-side rendering service.
- Exports are tenant-scoped by session; no URL parameters identify the tenant.

### Global 401 interceptor
- `lib/api-fetch.ts` patches `window.fetch` once at app boot (wired from `LocaleProvider`). Any 401 from `/api/*` triggers a hard redirect to `/login` (or `/admin/login` for `/api/admin/*`), except on the login pages themselves, where the form's own error handling stays intact.
- This means no client component ever needs to hand-code "session expired" detection.

### Expired-session redirect
- `/api/auth/session-invalid` clears the session cookie and redirects to `/login`. Called from the dashboard layout when a session is technically valid (JWT verifies) but points to a `Business` record that no longer exists — e.g. the tenant was deleted.

---

## Project Structure

```
app/
  layout.tsx                    Root layout (fonts, i18n direction, LocaleProvider, ToastProvider)
  globals.css                   Tailwind + design tokens + RTL + print rules
  page.tsx                      Redirects to /dashboard
  error.tsx                     Root-level error boundary
  not-found.tsx                 Global 404

  (auth)/
    layout.tsx                  Centered card chrome for unauthenticated pages
    login/page.tsx + LoginForm.tsx
    register/page.tsx + RegisterForm.tsx

  (billing)/
    layout.tsx                  Billing shell — same chrome as dashboard, no lapse block,
                                sidebar items other than Billing disabled when lapsed
    billing/page.tsx + BillingClient.tsx
    billing/plans/page.tsx + PlansComparison.tsx

  (dashboard)/
    layout.tsx                  Business shell — blocks on lapse, renders trial warning
    error.tsx, loading.tsx
    dashboard/page.tsx
    pos/page.tsx + POSClient.tsx
    inventory/page.tsx + InventoryClient.tsx
    suppliers/page.tsx + SuppliersClient.tsx
    customers/page.tsx + CustomersClient.tsx
    reports/page.tsx + ReportsClient.tsx
    profit-fund/page.tsx + ProfitFundClient.tsx
    profit-fund/[id]/ledger/page.tsx + TierLedgerClient.tsx
    staff/page.tsx + StaffClient.tsx
    settings/page.tsx + SettingsClient.tsx

  admin/
    login/page.tsx + AdminLoginForm.tsx
    (dashboard)/
      layout.tsx, AdminHeader.tsx
      page.tsx + AdminTenantsClient.tsx
      tenants/[id]/page.tsx + TenantDetailClient.tsx
      payments/page.tsx + AdminPaymentsClient.tsx + PaymentDetailModal.tsx
      plans/page.tsx + AdminPlansClient.tsx + PlanFormModal.tsx
      actions/page.tsx + AdminActionsClient.tsx
      settings/page.tsx + AdminSettingsClient.tsx

  print/
    settings/page.tsx           Print-friendly full-business report
    tier-ledger/[id]/page.tsx   Print-friendly single-tier ledger

  api/
    auth/{login,logout,session}/route.ts
    auth/session-invalid/route.ts
    businesses/route.ts + [id]/route.ts
    products/route.ts + [id]/route.ts
    suppliers/route.ts + [id]/route.ts
    suppliers/[id]/purchases/route.ts
    suppliers/[id]/payments/route.ts
    purchases/[id]/route.ts
    customers/route.ts + [id]/route.ts
    customers/[id]/ledger/route.ts
    sales/route.ts + [id]/route.ts
    profit-fund-tiers/route.ts + [id]/route.ts
    profit-fund-tiers/[id]/disbursements/route.ts
    profit-fund-tiers/[id]/rates/route.ts
    profit-fund-tiers/[id]/ledger/route.ts
    users/route.ts + [id]/route.ts
    settings/route.ts
    billing/payments/route.ts
    billing/plans/route.ts
    export/{products,customers,suppliers,sales,ledger}/route.ts
    export/tier-ledger/[id]/route.ts
    admin/auth/{login,logout,session}/route.ts
    admin/tenants/route.ts + [id]/route.ts
    admin/tenants/[id]/{grant,impersonate,reset-owner-password}/route.ts
    admin/payments/route.ts + [id]/{verify,reject}/route.ts
    admin/plans/route.ts + [id]/route.ts
    admin/settings/route.ts
    admin/actions/route.ts
    admin/impersonate/exit/route.ts

components/
  ui/                           Button, Input, Select, Modal, Table, Card, Badge,
                                Toast, Loader, EmptyState, Tabs, Pagination
  layout/                       Header, Sidebar, BottomNav, DashboardShell,
                                LanguageSwitcher, LocaleProvider, ErrorFallback,
                                ImpersonationBanner, SubscriptionBlocked,
                                TrialWarningBanner, nav-items.ts
  dashboard/                    MetricCard, TopItemsList, TimeRangePicker
  pos/                          ProductPicker, Cart, PaymentPanel,
                                QuickAddCustomerModal, SaleReceipt
  inventory/                    ProductTable, ProductFormModal, LowStockBanner
  suppliers/                    SupplierCard, SupplierFormModal,
                                PurchaseFormModal, PurchaseItemsEditor,
                                PurchasesListModal, PaymentModal
  customers/                    CustomerCard, CustomerFormModal,
                                PaymentRecordModal, LedgerModal, LedgerTable
  reports/                      TrendChart, ProfitBreakdownChart
  profit-fund/                  TierFormModal, TierBreakdownCard,
                                DisbursementModal, TierHistoryModal,
                                TierRatesModal
  staff/                        StaffTable, StaffFormModal
  settings/                     BusinessProfileForm, ModuleToggleList,
                                KhataSettingsForm, LanguagePreference,
                                RolesTab, ExportTab, PrintButton,
                                permission-groups.ts
  whatsapp/                     ReminderModal
  admin/                        BulkWhatsAppModal
  billing/                      PaymentSubmitModal, PaymentHistoryList

lib/
  db.ts                         MongoDB client + health check + _id stripping + index bootstrap
  db-indexes.ts                 All index definitions + ensureIndexes()
  mongo-transaction.ts          Shared withTransaction + ValidationError
  auth.ts                       Business password hashing, JWT issue/verify, cookie helpers
  admin-auth.ts                 Admin JWT issue/verify, cookie helpers, impersonation helpers
  tenant.ts                     Tenant context, scope/stamp helpers
  subscription-guard.ts         requireActiveTenant() for money-affecting API routes
  trial.ts                      Trial subscription helpers
  limits.ts                     Plan-limit checks per resource
  platform-settings.ts          Singleton platformSettings accessor
  plans.ts                      Plan tier CRUD + default seeding
  payments.ts                   Payment submission, verification, rejection (transactional)
  pricing.ts                    Duration options + amount calculation
  permissions.ts                Role → permission matrix
  api-response.ts               Standardised success/error envelope
  api-fetch.ts                  Global 401 interceptor (patches window.fetch)
  validate.ts                   Zod body parser with field-level error flattening
  format.ts                     formatCurrency (Rs), formatDate, formatDateTime, calculateFundAmount
  csv.ts                        CSV builder + download response helper
  export.ts                     Row fetch + mapping for each export type
  tier-ledger.ts                Rate-period ledger builder (per-tier)
  i18n.ts                       Locale, Dictionary, translate, typed keys
  i18n-server.ts                getLocale() — server-only, reads cookie
  i18n-actions.ts               setLocale() — Server Action
  dashboard.ts                  Dashboard aggregation + range resolver (PKT-aware)
  products.ts, suppliers.ts, customers.ts, sales.ts
  profit-fund.ts, reports.ts, staff.ts, settings.ts
  whatsapp.ts                   Deep-link builder, phone normalizer, templates
  admin-db.ts                   Admin data access (tenants list/detail, suspend, grant, actions)

types/
  index.ts                      All shared domain types + UNLIMITED constant

locales/
  en.json                       Source of truth for the Dictionary shape
  ur.json                       Structurally identical Urdu translations

scripts/
  create-admin.js               CLI bootstrap for the first admin user

proxy.ts                        Auth gating (formerly middleware.ts)
```

---

## Feature Modules — Detailed

### M1 — Business onboarding
- `/register` creates a new tenant: `Business` + first `User` (role: `owner`) in one request, then issues a session cookie (register = login). If the platform has trials enabled, seeds a trial subscription starting now.
- `/login` supports dual identifier (phone **or** email) and updates `lastLogin`.
- Login identifiers are **globally unique** — a login has no tenant context until after password check.
- Default bootstrap: all 7 modules enabled, currency `PKR`, khata settings conservative, reminder templates ship with sensible English/Urdu defaults.

### M2 — Dashboard
- Time-range picker: Today / Last 7 days / This month / Last 3 months / Last 6 months / This year / Custom.
- **Pakistan Standard Time** is used for calendar boundaries (no DST, fixed UTC+5). "Today" means today in PKT, not UTC.
- Four KPI cards (Sales, Profit, Receivables, Low stock) + Top 5 selling items.
- **Receivables single source of truth** — summed from `Customer.totalDue`, never `Sale.amountDue`.

### M3 — POS / Checkout
- Two-column desktop layout, stacked mobile layout with a tab bar.
- Payment methods: Cash (with change calculator), Khata, Online, Partial.
- Inline quick-add customer for khata sales.
- Server-side stock validation inside the transaction; client disables `+` beyond available stock.
- Credit limit enforcement respects `blockSaleOnLimitExceeded`.
- Sale deletion only for cash/online (khata sales carry a customer balance).
- Profit Fund allocations are snapshotted on every sale.

### M4 — Inventory
- Server-side pagination (25/page), search, category filter, low-stock toggle, archived tab.
- Archive (soft delete) via `active: false`.
- Product code unique per tenant.
- Low-stock detection uses per-product threshold or `Business.settings.lowStockThreshold`.

### M5 — Suppliers & Purchasing
- Supplier CRUD with per-tenant phone uniqueness.
- Purchase recording runs in a transaction — stock up, cost price updated to latest, supplier owed updated, initial payment audited.
- Purchase deletion only when no payments have been recorded.
- Supplier deletion refused if any purchase references it.

### M6 — Customers & Khata
- Khata settings-aware form — optional fields appear only when the corresponding setting is enabled.
- **Append-only ledger** — mistakes are corrected by offsetting entries.
- Payment recording runs in a transaction: `totalDue` decrement + ledger entry with `balanceAfter` snapshot.
- Over-payment is blocked; advance payments are deferred.

### M7 — Reports
- Same time-range presets as the dashboard — consistent UX.
- Trend chart — CSS-only bars, auto-buckets by day (≤31 days) or month.
- Profit breakdown — waterfall: gross profit → each active tier's deduction → net profit after funds.
- Top items (by revenue) and top customers (excluding walk-in sales).

### M8 — Profit Fund
- Multi-tier CRUD; tiers are user-named and user-percentaged.
- **Immutable rate history.** Every percentage change appends a new `profitFundTierRate` with an `effectiveFrom` timestamp. Existing history is never rewritten.
- **Snapshot-based allocations.** Sale creation freezes each enabled tier's `{ tierId, tierName, percentage, amount }` onto the sale document.
- Live calculation display on every tier card (current rate + allocated this range).
- Disbursement tracking with running available balance.
- Enable/disable toggle without losing historical contributions.
- **Detailed per-tier ledger** at `/profit-fund/[id]/ledger` — one row per rate period, showing profit, allocation (from snapshots), disbursements, and running balance.
- **Rate history modal** — lists every change with date and time.
- **CSV + PDF export** for the ledger, with locale-aware column headers.
- Tier deletion refused if any disbursement references it; rate history cleanup runs in the same transaction.

### M9 — WhatsApp reminders
- `wa.me` deep links — zero cost, no Meta Business API.
- Phone normalizer accepts Pakistani formats.
- Owner-configurable templates with `{{customerName}}`, `{{businessName}}`, `{{amount}}`, `{{phone}}` placeholders.
- Language toggle (English / Urdu) with RTL preview.

### M10 — Staff management
- Owner only created by register flow — never assignable via staff API.
- **Owner protection** — cannot be deleted, role-changed, or deactivated.
- **Self-protection** — no one can change their own role/active flag.
- Soft delete via `active: false`.
- `passwordHash` stripped from every response via `toSafeUser`.

### M11 — Settings
Six tabs, each with its own save button:
- **Profile** — business name, owner name, phone, address
- **Modules** — toggle each of the 7 modules
- **Khata** — credit limit rules, due-date tracking, guarantor capture, tags, partial payments, reminder templates, default reminder language
- **Roles** — read-only reference matrix of what each role can do
- **Language** — UI locale for this device + business default language
- **Export** — CSV downloads and print/PDF, with time-range picker

### M12 — Platform admin console
- Separate auth (`adminUsers` collection, `admin_session_token` cookie, `ADMIN_JWT_SECRET`).
- Seeded via `scripts/create-admin.js` — no self-signup.
- Tenants list with subscription-status + signup-window filters and an "expiring soon" toggle. Status badges reflect the *effective* status (raw status + expiry date).
- Tenant detail with usage counts, subscription state, and actions: suspend, activate, grant/renew, reset owner password, impersonate.
- Impersonation issues a temporary business session (30 min) under the admin's own credentials; the business dashboard shows a yellow banner with an "Exit impersonation" button; every start is logged.
- Payments inbox with verify/reject and inline WhatsApp chat link.
- Plans manager for full CRUD of subscription tiers (pricing, features, per-resource limits).
- Platform settings — trial length, warning threshold, support channels, blocked-screen overrides, bulk-WhatsApp template.
- Bulk WhatsApp reminders with a template-driven walkthrough loop.
- Audit log — every action recorded with actor, target, and metadata.

### M13 — Billing & subscription (business-facing)
- `/billing` shows current subscription, days left, plan comparison link, and payment history.
- `/billing/plans` renders a live comparison of active plans, generated from `planTiers`.
- Payment submission captures plan, months, method, transaction ID, date, and notes — server generates a reference for WhatsApp.
- Pending/verified/rejected payments are color-coded; rejection reasons are shown inline.
- **Billing routes live in a separate route group (`app/(billing)/`)** so they stay reachable when the subscription has lapsed. Sidebar items other than Billing are disabled in this state.

### M14 — Exports & print
- Six CSV downloads: Products, Customers, Suppliers, Sales (range), Khata Ledger (range), Tier Ledger (range).
- Column headers are translated to the caller's current locale (English / Urdu).
- Filenames embed the business slug and today's date.
- Two print routes:
  - `/print/settings` — full business report with all five core datasets.
  - `/print/tier-ledger/[id]` — single-tier rate-history ledger.
- Users save as PDF via the browser's native print dialog.

---

## Getting Started

### Prerequisites

- **Node.js** 20.10 or newer (for `--env-file` support in the admin bootstrap script)
- A **MongoDB Atlas** connection string — free M0 tier is sufficient (it's a replica set, required for transactions)
- **npm** (bundled with Node)

### Installation

```bash
git clone https://github.com/usamathodyssey/business-management-platform.git
cd business-management-platform
npm install
```

### Environment Variables

Create `.env.local` at the project root:

```env
# Required
MONGODB_URI="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/"
JWT_SECRET="<generate-a-strong-random-secret>"

# Optional but recommended
# A distinct signing key for admin sessions. If unset, the admin secret is
# derived from JWT_SECRET + ":admin", which is safe but less explicit for
# rotation.
ADMIN_JWT_SECRET="<generate-a-second-strong-secret>"

# Platform operator details shown to customers on the billing page and
# on the blocked screen
PLATFORM_WHATSAPP_NUMBER="923001234567"
PLATFORM_DISPLAY_NAME="Your Platform Name"
PLATFORM_JAZZCASH_NUMBER="03001234567"
PLATFORM_EASYPAISA_NUMBER="03001234567"
PLATFORM_BANK_DETAILS="Bank Name · Acct 0000 0000 · Title: Your Name"
```

Generate a strong secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

> **Never commit `.env.local`.** It is gitignored by default.

### Bootstrap the first admin

```bash
node --env-file=.env.local scripts/create-admin.js \
  admin@yourdomain.com "S3curePassword" "Admin Name"
```

Log in at `/admin/login`.

### Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production build

```bash
npm run build
npm run start
```

---

## Deployment (Vercel)

1. Push the repository to GitHub.
2. Import the repository at [vercel.com/new](https://vercel.com/new).
3. Add the environment variables under **Project Settings → Environment Variables**:
   - `MONGODB_URI`
   - `JWT_SECRET` — generate a **fresh** secret; don't reuse the dev value
   - `ADMIN_JWT_SECRET` — recommended
   - `PLATFORM_*` — set your real support and payment details
4. Ensure MongoDB Atlas's **Network Access** whitelist includes Vercel's egress IPs (or `0.0.0.0/0` for simplicity during testing).
5. Deploy. Vercel auto-detects Next.js.

Post-deploy checklist:
- Create the first admin via the same script (pointing at the production `.env`).
- Register a fresh tenant on the deployed URL.
- Verify MongoDB Atlas shows the new documents.
- Walk through POS → Inventory → Reports on the live URL.
- Test the trial flow (register, check `/billing`, verify the warning banner fires when the expiry nears).

---

## Database Collections

| Collection | Purpose | Key indexes |
|---|---|---|
| `businesses` | Tenant records (settings, enabled modules, subscription) | `id` (unique) |
| `users` | Staff + owners (globally unique phone/email) | `id`, `phone` (unique), `email` (partial unique), `businessId + name` |
| `products` | Per-tenant product catalog | `id`, `businessId + active + name`, `businessId + code` (unique) |
| `suppliers` | Per-tenant vendors | `id`, `businessId + phone` (unique), `businessId + name` |
| `purchases` | Purchase records | `id`, `businessId + supplierId + date` |
| `supplierPayments` | Payment audit rows | `id`, `businessId + supplierId + date`, `purchaseId` |
| `customers` | Per-tenant customers | `id`, `businessId + phone` (unique), `businessId + name` |
| `ledgerEntries` | Customer khata history | `id`, `businessId + customerId + date` |
| `sales` | Sales records (includes frozen `profitFundAllocations`) | `id`, `businessId + date`, `businessId + customerId + date` |
| `profitFundTiers` | Fund tier configuration | `id`, `businessId + createdAt`, `businessId + name` (unique) |
| `profitFundTierRates` | Append-only rate history | `id`, `businessId + tierId + effectiveFrom` |
| `profitFundDisbursements` | Payout records | `id`, `businessId + tierId + date` |
| `payments` | Subscription payment submissions | `id`, `reference` (unique), `status + createdAt`, `businessId + createdAt` |
| `planTiers` | Subscription plan definitions | `id`, `slug` (unique), `displayOrder` |
| `platformSettings` | Singleton platform configuration | `id` (unique) |
| `adminUsers` | Platform operator accounts | `id`, `email` (unique) |
| `adminActions` | Admin audit log | `id`, `adminId + createdAt`, `targetBusinessId + createdAt` |

> **Note:** All `id` fields are application-generated UUIDs, not Mongo's `_id`. The data layer strips `_id` transparently via a wrapped `Db` in `lib/db.ts`.

Indexes are created automatically on first successful request via `ensureIndexes()` — see `lib/db-indexes.ts`.

---

## Security Model

- **Passwords** — hashed with bcrypt (cost 10). Plaintext never leaves the request handler that hashes it.
- **Sessions** — JWT signed with HS256. Business session cookie uses `JWT_SECRET`; admin session cookie uses `ADMIN_JWT_SECRET` (or a derived key). Both cookies are `httpOnly`, `secure` in production, `sameSite: "lax"`.
- **CSRF posture** — sameSite session cookie, all mutations POST/PATCH/DELETE with JSON bodies.
- **Tenant isolation** — every query scoped by `businessId`. `assertOwnedByTenant` guards defence-in-depth for documents fetched by `id` alone. Cross-tenant ids return 404, never 403.
- **Permission checks** in every API route via `hasPermission(role, ...)`; the UI hides navigation for modules the tenant hasn't enabled.
- **Plan limits** enforced server-side via `lib/limits.ts` before any insert of a billable resource.
- **Subscription lapsed** mutations rejected with 403 `SUBSCRIPTION_LAPSED` via `requireActiveTenant()`.
- **No client trust** — validation happens twice: client-side for UX (translated errors), server-side for correctness (Zod schemas + transactional business rules).
- **Global 401 interceptor** redirects expired sessions to the correct login page without leaving the user stranded on a broken form.
- **Impersonation is bounded** — 30-minute session, announced with a banner, logged in the audit trail.

---

## Roadmap

**Foundation — complete**
- [x] Project setup, strict TypeScript + ESLint
- [x] Database layer, API conventions, request validation
- [x] Auth (JWT via `jose`), sessions, role-based permissions
- [x] Multi-tenant scoping helpers
- [x] Bilingual i18n (English / Urdu) with RTL
- [x] Reusable UI component library
- [x] Global layout & navigation
- [x] Error / loading / empty states

**Business modules — complete**
- [x] Business onboarding
- [x] Dashboard
- [x] POS / checkout
- [x] Inventory
- [x] Suppliers & purchasing
- [x] Customers & khata
- [x] Reports
- [x] Profit Fund (with rate history + per-tier ledger)
- [x] WhatsApp reminders
- [x] Staff management
- [x] Settings
- [x] Exports & print

**SaaS layer — complete**
- [x] Platform admin console
- [x] Dynamic subscription plans
- [x] Plan feature limits + enforcement
- [x] Trial lifecycle (auto-grant, warning, lapse block)
- [x] Manual payment submission + admin verification
- [x] Impersonation with banner + audit
- [x] Bulk WhatsApp reminders from the admin console
- [x] Platform settings (trial length, support channels, templates)
- [x] Audit log

**Deployment**
- [x] Ready for Vercel
- [x] Live deployment + smoke test

**Future considerations**
- JazzCash / EasyPaisa Merchant API for automated payments
- OTP verification on signup
- Rate limiting + CAPTCHA
- Automated renewal reminders via email / SMS
- Per-tenant MongoDB isolation for enterprise customers (currently shared, tenant-scoped)

---

## Contributing

This is currently a private, single-developer project. Contribution guidelines will be published if the project is open-sourced.

---

## License

Proprietary — all rights reserved.
© 2026 Usama Bhatti.

---

## Author

**Usama Bhatti** — Full-stack developer
GitHub: [@usamatechodyssey](https://github.com/usamatechodyssey)
