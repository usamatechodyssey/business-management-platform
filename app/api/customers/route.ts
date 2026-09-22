// app/api/customers/route.ts
//
// GET  — list customers for the tenant, optional `?q=` search. Requires
//        "customers.view".
// POST — create a customer. Requires "customers.manage".
//
// Field-level validation lives client-side (CustomerFormModal, batch 3)
// with the user's locale. Server-side Zod is a security backstop whose
// English messages are never surfaced. Cross-cutting checks (duplicate
// phone within tenant, plan limit) return a translatable `code`.

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/validate";
import { requireTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { checkResourceLimit } from "@/lib/limits";
import { requireActiveTenant } from "@/lib/subscription-guard";
import {
  insertCustomer,
  isCustomerPhoneTaken,
  listCustomers,
} from "@/lib/customers";
import type { Customer } from "@/types";

const emptyToUndefined = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

const optionalNonNegativeNumber = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.number().min(0).optional()
);

// Every khata-settings-gated field is accepted here regardless of the
// business's current khataSettings. The client decides what to render;
// the server stores whatever valid data it receives so changing settings
// later doesn't lose existing values.
const createCustomerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(10).max(20),
  address: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
  creditLimit: optionalNonNegativeNumber,
  dueDate: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
  ),
  guarantorName: z.preprocess(
    emptyToUndefined,
    z.string().max(100).optional()
  ),
  guarantorPhone: z.preprocess(
    emptyToUndefined,
    z.string().max(20).optional()
  ),
  tag: z.preprocess(emptyToUndefined, z.string().max(50).optional()),
  notes: z.preprocess(emptyToUndefined, z.string().max(500).optional()),
});

export async function GET(req: NextRequest) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "customers.view")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() || undefined;
  const customers = await listCustomers(tenant.businessId, q);

  return apiSuccess({ customers });
}

export async function POST(req: NextRequest) {
  const tenantResult = await requireActiveTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "customers.manage")) {
    return apiError("You don't have permission to do this.", 403);
  }

  // Plan-limit gate — runs before any insert or uniqueness check.
  const limit = await checkResourceLimit(tenant.businessId, "customers");
  if (!limit.allowed) {
    return apiError(
      "You've reached the customer limit for your plan.",
      403,
      {
        code: "LIMIT_REACHED",
        fields: {
          resource: "customers",
          current: String(limit.current),
          limit: String(limit.limit),
        },
      }
    );
  }

  const parsed = await parseJsonBody(req, createCustomerSchema);
  if (!parsed.success) return parsed.response;

  const {
    name,
    phone,
    address,
    creditLimit,
    dueDate,
    guarantorName,
    guarantorPhone,
    tag,
    notes,
  } = parsed.data;

  if (await isCustomerPhoneTaken(tenant.businessId, phone)) {
    return apiError("Customer phone is already registered.", 409, {
      code: "CUSTOMER_PHONE_TAKEN",
    });
  }

  const customer: Customer = {
    id: crypto.randomUUID(),
    businessId: tenant.businessId,
    name,
    phone,
    totalDue: 0,
    createdAt: new Date().toISOString(),
  };

  if (address) customer.address = address;
  if (typeof creditLimit === "number") customer.creditLimit = creditLimit;
  if (dueDate) customer.dueDate = dueDate;
  if (guarantorName) customer.guarantorName = guarantorName;
  if (guarantorPhone) customer.guarantorPhone = guarantorPhone;
  if (tag) customer.tag = tag;
  if (notes) customer.notes = notes;

  await insertCustomer(customer);

  return apiSuccess(customer, 201);
}