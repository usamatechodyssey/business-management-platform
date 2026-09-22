// app/api/admin/plans/route.ts
//
// GET  — list all plan tiers (admin console)
// POST — create a new plan tier

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/validate";
import { requireAdmin } from "@/lib/admin-auth";
import {
  insertPlan,
  isPlanSlugTaken,
  listAllPlans,
} from "@/lib/plans";
import { writeAdminAction } from "@/lib/admin-db";

const UNLIMITED = -1;

const limitsSchema = z.object({
  users: z.number().int().min(UNLIMITED),
  products: z.number().int().min(UNLIMITED),
  customers: z.number().int().min(UNLIMITED),
  suppliers: z.number().int().min(UNLIMITED),
  salesPerMonth: z.number().int().min(UNLIMITED),
});

const createPlanSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, or dashes."),
  name: z.string().trim().min(2).max(50),
  priceMonthly: z.number().int().min(0),
  description: z.preprocess(
    (v) => {
      if (typeof v !== "string") return v;
      const t = v.trim();
      return t === "" ? undefined : t;
    },
    z.string().max(200).optional()
  ),
  features: z.array(z.string().trim().min(1).max(120)).max(20),
  limits: limitsSchema,
  displayOrder: z.number().int().min(0).max(999),
  active: z.boolean(),
});

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.success) return guard.response;

  const plans = await listAllPlans();
  return apiSuccess({ plans });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.success) return guard.response;
  const { admin } = guard;

  const parsed = await parseJsonBody(req, createPlanSchema);
  if (!parsed.success) return parsed.response;
  const input = parsed.data;

  if (await isPlanSlugTaken(input.slug)) {
    return apiError("A plan with this slug already exists.", 409, {
      code: "PLAN_SLUG_TAKEN",
    });
  }

  const plan = await insertPlan(input);

  await writeAdminAction({
    adminId: admin.adminId,
    adminName: admin.name,
    type: "plan.create",
    metadata: { slug: plan.slug, name: plan.name },
  });

  return apiSuccess(plan, 201);
}