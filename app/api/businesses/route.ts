// app/api/businesses/route.ts
//
// POST /api/businesses — business onboarding (register flow).
// Creates a new Business (tenant) and its first User (role: "owner") in
// one request, then issues a session cookie so the caller is immediately
// logged in. If the platform has trials enabled, seeds a trial
// subscription starting now.

import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/validate";
import { hashPassword, createSessionToken, setSessionCookie } from "@/lib/auth";
import { getLocale } from "@/lib/i18n-server";
import {
  DEFAULT_REMINDER_TEMPLATE_ENGLISH,
  DEFAULT_REMINDER_TEMPLATE_URDU,
} from "@/lib/whatsapp";
import { getPlatformSettings } from "@/lib/platform-settings";
import { buildTrialSubscription } from "@/lib/trial";
import type {
  Business,
  BusinessSettings,
  KhataSettings,
  ModuleKey,
  User,
} from "@/types";

const ALL_MODULES: ModuleKey[] = [
  "pos",
  "inventory",
  "suppliers",
  "customers",
  "reports",
  "profitFund",
  "staff",
];

const registerSchema = z.object({
  businessName: z.string().trim().min(2).max(100),
  ownerName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(10).max(20),
  email: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed === "" ? undefined : trimmed;
    },
    z.string().email().max(254).optional()
  ),
  password: z
    .string()
    .min(8)
    .regex(/[A-Za-z]/)
    .regex(/\d/),
});

export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req, registerSchema);
  if (!parsed.success) return parsed.response;

  const { businessName, ownerName, phone, email, password } = parsed.data;

  const db = await getDb();
  const users = db.collection<User>("users");
  const businesses = db.collection<Business>("businesses");

  const phoneTaken = await users.findOne({ phone }, { projection: { id: 1 } });
  if (phoneTaken) {
    return apiError("Phone number is already registered.", 409, {
      code: "PHONE_TAKEN",
    });
  }

  if (email) {
    const emailTaken = await users.findOne(
      { email },
      { projection: { id: 1 } }
    );
    if (emailTaken) {
      return apiError("Email is already registered.", 409, {
        code: "EMAIL_TAKEN",
      });
    }
  }

  const now = new Date().toISOString();
  const businessId = crypto.randomUUID();
  const ownerId = crypto.randomUUID();

  const locale = await getLocale();

  const khataSettings: KhataSettings = {
    creditLimitEnabled: false,
    defaultCreditLimit: 0,
    blockSaleOnLimitExceeded: false,
    dueDateTrackingEnabled: false,
    defaultPaymentTermsDays: 30,
    guarantorEnabled: false,
    customerTagsEnabled: false,
    allowPartialPayments: true,
    requireCustomerPhoneForCredit: false,
    reminderTemplateUrdu: DEFAULT_REMINDER_TEMPLATE_URDU,
    reminderTemplateEnglish: DEFAULT_REMINDER_TEMPLATE_ENGLISH,
    defaultReminderLanguage: "ur",
  };

  const settings: BusinessSettings = {
    currency: "PKR",
    lowStockThreshold: 10,
    language: locale,
    khataSettings,
  };

  const business: Business = {
    id: businessId,
    name: businessName,
    ownerName,
    phone,
    enabledModules: ALL_MODULES,
    settings,
    createdAt: now,
  };

  // Auto-trial: read platform config at register time so an admin
  // change to trialDays takes effect on the next signup — existing
  // trials are unaffected.
  const platform = await getPlatformSettings();
  if (platform.trialEnabled && platform.trialDays > 0) {
    business.subscription = buildTrialSubscription(platform.trialDays);
  }

  const passwordHash = await hashPassword(password);

  const owner: User = {
    id: ownerId,
    businessId,
    name: ownerName,
    phone,
    role: "owner",
    passwordHash,
    active: true,
    createdAt: now,
  };

  if (email) {
    owner.email = email;
  }

  await businesses.insertOne(business);
  await users.insertOne(owner);

  const token = await createSessionToken({
    userId: owner.id,
    businessId: owner.businessId,
    role: owner.role,
    name: owner.name,
  });
  await setSessionCookie(token);

  return apiSuccess(
    {
      id: owner.id,
      name: owner.name,
      role: owner.role,
      businessId: owner.businessId,
    },
    201
  );
}