// app/api/suppliers/route.ts
//
// GET  — list suppliers for the tenant, optional `?q=` search. Requires
//        "suppliers.view".
// POST — create a supplier. Requires "suppliers.manage".
//
// Field-level validation lives client-side (SupplierFormModal, batch 4)
// with the user's locale. Server-side Zod is a security backstop whose
// English messages are never surfaced. Cross-cutting checks (duplicate
// phone within tenant) return a translatable `code`.

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/validate";
import { requireTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import {
  insertSupplier,
  isSupplierPhoneTaken,
  listSuppliers,
} from "@/lib/suppliers";
import type { Supplier } from "@/types";

const emptyToUndefined = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

const createSupplierSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(10).max(20),
  address: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
  contactPerson: z.preprocess(
    emptyToUndefined,
    z.string().max(100).optional()
  ),
});

export async function GET(req: NextRequest) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "suppliers.view")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() || undefined;
  const suppliers = await listSuppliers(tenant.businessId, q);

  return apiSuccess({ suppliers });
}

export async function POST(req: NextRequest) {
  const tenantResult = await requireTenant();
  if (!tenantResult.success) return tenantResult.response;
  const { tenant } = tenantResult;

  if (!hasPermission(tenant.role, "suppliers.manage")) {
    return apiError("You don't have permission to do this.", 403);
  }

  const parsed = await parseJsonBody(req, createSupplierSchema);
  if (!parsed.success) return parsed.response;

  const { name, phone, address, contactPerson } = parsed.data;

  if (await isSupplierPhoneTaken(tenant.businessId, phone)) {
    return apiError("Supplier phone is already registered.", 409, {
      code: "SUPPLIER_PHONE_TAKEN",
    });
  }

  const supplier: Supplier = {
    id: crypto.randomUUID(),
    businessId: tenant.businessId,
    name,
    phone,
    totalOwed: 0,
    createdAt: new Date().toISOString(),
  };

  if (address) supplier.address = address;
  if (contactPerson) supplier.contactPerson = contactPerson;

  await insertSupplier(supplier);

  return apiSuccess(supplier, 201);
}