// app/api/admin/plans/[id]/route.ts
//
// GET    — read one plan
// PATCH  — update plan fields
// DELETE — remove a plan, refused if any business is currently on it
//          or if it's the trial plan

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/validate";
import { requireAdmin } from "@/lib/admin-auth";
import {
  countBusinessesOnPlan,
  deletePlanById,
  getPlanById,
  isPlanSlugTaken,
  updatePlanFields,
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

const updatePlanSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  name: z.string().trim().min(2).max(50).optional(),
  priceMonthly: z.number().int().min(0).optional(),
  description: z.preprocess(
    (v) => {
      if (typeof v !== "string") return v;
      const t = v.trim();
      return t === "" ? undefined : t;
    },
    z.string().max(200).optional()
  ),
  features: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  limits: limitsSchema.optional(),
  displayOrder: z.number().int().min(0).max(999).optional(),
  active: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.success) return guard.response;

  const { id } = await params;
  const plan = await getPlanById(id);
  if (!plan) return apiError("Plan not found.", 404);

  return apiSuccess(plan);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.success) return guard.response;
  const { admin } = guard;

  const { id } = await params;
  const existing = await getPlanById(id);
  if (!existing) return apiError("Plan not found.", 404);

  const parsed = await parseJsonBody(req, updatePlanSchema);
  if (!parsed.success) return parsed.response;
  const updates = parsed.data;

  if (Object.keys(updates).length === 0) {
    return apiError("No fields to update.", 400);
  }

  // The trial plan's slug is referenced by lib/plans.ensureDefaultPlans.
  // Renaming it would break that check, so we block slug changes on it.
  if (existing.isTrialPlan && updates.slug && updates.slug !== existing.slug) {
    return apiError("The trial plan's slug cannot be changed.", 422, {
      code: "TRIAL_SLUG_LOCKED",
    });
  }

  if (updates.slug && updates.slug !== existing.slug) {
    if (await isPlanSlugTaken(updates.slug, id)) {
      return apiError("A plan with this slug already exists.", 409, {
        code: "PLAN_SLUG_TAKEN",
      });
    }
  }

  const updated = await updatePlanFields(id, updates);
  if (!updated) return apiError("Plan not found.", 404);

  await writeAdminAction({
    adminId: admin.adminId,
    adminName: admin.name,
    type: "plan.update",
    metadata: { slug: updated.slug, name: updated.name },
  });

  return apiSuccess(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.success) return guard.response;
  const { admin } = guard;

  const { id } = await params;
  const plan = await getPlanById(id);
  if (!plan) return apiError("Plan not found.", 404);

  if (plan.isTrialPlan) {
    return apiError("The trial plan cannot be deleted.", 422, {
      code: "TRIAL_PROTECTED",
    });
  }

  const inUse = await countBusinessesOnPlan(plan.slug);
  if (inUse > 0) {
    return apiError(
      `This plan is in use by ${inUse} business(es) and cannot be deleted.`,
      409,
      { code: "PLAN_IN_USE", fields: { count: String(inUse) } }
    );
  }

  const deleted = await deletePlanById(id);
  if (!deleted) return apiError("Plan not found.", 404);

  await writeAdminAction({
    adminId: admin.adminId,
    adminName: admin.name,
    type: "plan.delete",
    metadata: { slug: plan.slug, name: plan.name },
  });

  return apiSuccess({ deleted: true });
}