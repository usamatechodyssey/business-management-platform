# Business Management Platform

> A multi-tenant, bilingual (English / اردو), mobile-first business management system — purpose-built for Pakistani retail & wholesale businesses.

**Status:** 🚧 In active development — foundation modules complete, feature modules in progress.

---

## Overview

Business Management Platform (BMP) is a cloud-based, multi-tenant SaaS application that consolidates day-to-day operations of a small or medium retail/wholesale business into a single, mobile-friendly web app:

- Point of Sale (POS) and checkout
- Real-time inventory and stock tracking
- Supplier and purchase management
- Customer ledgers (digital *khata*) with credit limits and guarantors
- Sales, profit, and financial reporting
- **Profit Fund** — a fully user-configurable, multi-tier system for allocating a percentage of profit (e.g. charity, staff bonus, reinvestment — the owner names each tier)
- WhatsApp-based customer reminders via `wa.me` deep links
- Role-based staff management

The product is designed to work seamlessly on **mobile, tablet, laptop, and desktop** from a single codebase, with **no app-store installation required**.

---

## Core Principles

1. **Multi-tenant from day one** — every business-owned document carries a `businessId`; a single shared database serves all tenants.
2. **Modular feature flags** — each tenant's `Business` record declares its `enabledModules`; UI and API are filtered accordingly.
3. **Role-based access control** — four roles (`owner`, `manager`, `cashier`, `accountant`) with a granular permission matrix.
4. **Bilingual, RTL-aware** — full English + Urdu support with cookie-based locale switching. No URL prefix — layout flips via logical CSS properties (`ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`).
5. **Config over hardcoding** — nothing business-specific (currency, thresholds, fund names, percentages) is hardcoded; all is per-tenant configuration.
6. **Type safety enforced at build time** — strict TypeScript, no `any`, no dead code, no unused imports.
7. **Currency is always `Rs`** (Pakistani Rupee) — every amount flows through `lib/format.ts → formatCurrency()`. Never `$`.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI Runtime | React 19 |
| Language | TypeScript (strict, `noUncheckedIndexedAccess`, no `any`) |
| Styling | Tailwind CSS v4 (CSS-variable design tokens, logical properties) |
| Database | MongoDB Atlas (native `mongodb` driver, no ODM) |
| Auth | `jose` (JWT, Edge-runtime compatible) + `bcryptjs` |
| Validation | `zod` |
| Date handling | `date-fns` |
| Icons | `lucide-react` |
| Fonts | Geist Sans, Geist Mono, Noto Nastaliq Urdu |
| Deployment target | Vercel |

---

## Architecture Highlights

- **Cookie-based session auth** (`httpOnly`, 7-day expiry), verified both in `middleware.ts` (Edge) and in route handlers.
- **Tenant isolation** enforced via `lib/tenant.ts` — every query is scoped by `businessId`; every write is stamped with it.
- **Type-safe i18n** — the `Dictionary` type is derived from `locales/en.json`; `ur.json` must match structurally or the build fails. Translation keys are a compile-time union, so typos are impossible.
- **RTL support** — `html[dir="rtl"]` switches the body font to Noto Nastaliq Urdu; all components use logical Tailwind properties so layout mirrors automatically.
- **Profit Fund** — a generalized multi-tier system replacing the original single hardcoded "Barkat Khana". Tiers are user-named, user-percentaged, and their amounts are shown as live calculations from actual profit.

---

## Project Structure

```
app/
  layout.tsx                    Root layout (fonts, i18n direction, toast provider)
  globals.css                   Tailwind + design tokens + RTL rules
  page.tsx                      Redirects to /dashboard
  (auth)/                       Login / register pages
  (dashboard)/                  Authenticated app shell + feature pages
  api/                          API route handlers (auth, business, sales, etc.)
components/
  ui/                           Reusable primitives (Button, Input, Modal, Table, Toast, ...)
  layout/                       Header, Sidebar, BottomNav, LanguageSwitcher
  dashboard/, pos/, inventory/, suppliers/, customers/, reports/, profit-fund/, staff/, settings/, whatsapp/
lib/
  db.ts, auth.ts, tenant.ts, permissions.ts, i18n.ts, i18n-actions.ts,
  api-response.ts, validate.ts, format.ts
types/
  index.ts                      All shared domain types
locales/
  en.json, ur.json              Translation dictionaries
middleware.ts                   Auth gating on every non-API route
```

---

## Getting Started

### Prerequisites

- **Node.js** 20 or newer
- A **MongoDB Atlas** connection string (free tier is sufficient)
- **npm** (bundled with Node)

### Installation

```bash
git clone https://github.com/usamathodyssey/business-management-platform.git
cd business-management-platform
npm install
```

### Environment Variables

Create a `.env.local` file at the project root with the following:

```env
MONGODB_URI="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/"
JWT_SECRET="<generate-a-strong-random-secret>"
```

Generate a secure `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

> **Never commit `.env.local`.** It is gitignored by default.

### Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production build

```bash
npm run build
npm run start
```

---

## Roadmap

**Foundation (complete)**
- [x] Project setup, strict TypeScript + ESLint configuration
- [x] Database layer, API response conventions, request validation
- [x] Auth (JWT via `jose`), sessions, role-based permissions
- [x] Multi-tenant scoping helpers
- [x] Bilingual i18n (English / Urdu) with RTL
- [x] Reusable UI component library
- [ ] Global layout & navigation *(in progress)*
- [ ] Error / loading / empty states

**Feature Modules**
- [ ] Business onboarding (login, register)
- [ ] Dashboard
- [ ] Inventory
- [ ] Suppliers & purchasing
- [ ] Customers & khata
- [ ] POS / checkout
- [ ] Profit Fund
- [ ] Reports
- [ ] WhatsApp reminders
- [ ] Staff management
- [ ] Settings

**Deployment**
- [ ] Vercel deployment + end-to-end test

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
GitHub: [@usamathodyssey](https://github.com/usamathodyssey)