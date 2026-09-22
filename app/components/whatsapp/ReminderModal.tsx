// app/components/whatsapp/ReminderModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Phone } from "lucide-react";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { useToast } from "@/app/components/ui/Toast";
import { formatCurrency } from "@/lib/format";
import { translate, type Dictionary } from "@/lib/i18n";
import {
  DEFAULT_REMINDER_TEMPLATE_ENGLISH,
  DEFAULT_REMINDER_TEMPLATE_URDU,
  buildWhatsAppUrl,
  renderTemplate,
  type ReminderPlaceholder,
} from "@/lib/whatsapp";
import type { Customer, KhataSettings } from "@/types";

type ReminderLanguage = "en" | "ur";

interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  businessName: string;
  khataSettings: KhataSettings;
  dictionary: Dictionary;
}

// Language toggles only affect which template gets used and how the
// preview reads — the underlying customer data doesn't change.
export function ReminderModal({
  isOpen,
  onClose,
  customer,
  businessName,
  khataSettings,
  dictionary,
}: ReminderModalProps) {
  const { push } = useToast();

  const [language, setLanguage] = useState<ReminderLanguage>(
    khataSettings.defaultReminderLanguage
  );

  // Reset back to the business default every time the modal opens —
  // changing language for one customer shouldn't leak into the next.
  useEffect(() => {
    if (!isOpen) return;
    setLanguage(khataSettings.defaultReminderLanguage);
  }, [isOpen, customer.id, khataSettings.defaultReminderLanguage]);

  // Pick the template — prefer the owner-configured one, fall back to the
  // built-in default if the business predates the defaults (older records
  // may still have an empty string).
  const template = useMemo(() => {
    if (language === "ur") {
      return (
        khataSettings.reminderTemplateUrdu ||
        DEFAULT_REMINDER_TEMPLATE_URDU
      );
    }
    return (
      khataSettings.reminderTemplateEnglish ||
      DEFAULT_REMINDER_TEMPLATE_ENGLISH
    );
  }, [
    language,
    khataSettings.reminderTemplateEnglish,
    khataSettings.reminderTemplateUrdu,
  ]);

  // Values fed into the template. amount uses formatCurrency so the
  // "Rs. 1,234" string lands in the message — matching how every other
  // screen shows money.
  const values: Partial<Record<ReminderPlaceholder, string>> = useMemo(
    () => ({
      customerName: customer.name,
      businessName,
      amount: formatCurrency(customer.totalDue),
      phone: customer.phone,
    }),
    [customer.name, customer.totalDue, customer.phone, businessName]
  );

  const message = useMemo(
    () => renderTemplate(template, values),
    [template, values]
  );

  const whatsappUrl = useMemo(
    () => buildWhatsAppUrl(customer.phone, message),
    [customer.phone, message]
  );

  const hasDue = customer.totalDue > 0;

  function handleOpenWhatsApp() {
    if (!whatsappUrl) return;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    push({
      message: translate(dictionary, "whatsapp.sent"),
      variant: "success",
    });
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={translate(dictionary, "whatsapp.reminderTitle")}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            {translate(dictionary, "common.cancel")}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleOpenWhatsApp}
            disabled={!whatsappUrl || !hasDue}
            leadingIcon={
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
            }
          >
            {translate(dictionary, "whatsapp.send")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Customer summary line */}
        <div className="rounded-lg bg-surface-muted px-3 py-2 text-sm">
          <span className="text-text-muted">
            {translate(dictionary, "customers.fields.name")}:{" "}
          </span>
          <span className="font-medium text-foreground">
            {customer.name}
          </span>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-text-muted">
            <Phone className="h-3 w-3" aria-hidden="true" />
            <span>{customer.phone}</span>
          </div>
        </div>

        {/* Invalid phone warning — blocks the send button */}
        {!whatsappUrl && (
          <div
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            {translate(dictionary, "whatsapp.invalidPhone")}
          </div>
        )}

        {/* Zero balance — nothing to remind about */}
        {!hasDue && (
          <div
            role="alert"
            className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-text-muted"
          >
            {translate(dictionary, "customers.card.clear")}
          </div>
        )}

        {/* Language toggle */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">
            {translate(dictionary, "whatsapp.languageLabel")}
          </span>
          <div
            role="radiogroup"
            className="inline-flex items-center gap-1 self-start rounded-lg border border-border bg-surface p-1"
          >
            {(["en", "ur"] as ReminderLanguage[]).map((lang) => {
              const isActive = language === lang;
              const labelKey =
                lang === "en"
                  ? "whatsapp.languageEnglish"
                  : "whatsapp.languageUrdu";
              return (
                <button
                  key={lang}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => setLanguage(lang)}
                  className={[
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    isActive
                      ? "bg-primary text-white"
                      : "text-text-muted hover:bg-surface-muted",
                  ].join(" ")}
                >
                  {translate(dictionary, labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Message preview */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">
            {translate(dictionary, "whatsapp.previewLabel")}
          </span>
          <div
            dir={language === "ur" ? "rtl" : "ltr"}
            className={[
              "rounded-lg border border-border bg-surface-muted px-3 py-3 text-sm text-foreground whitespace-pre-wrap wrap-break-word",
              language === "ur" ? "text-end" : "text-start",
            ].join(" ")}
          >
            {message}
          </div>
        </div>
      </div>
    </Modal>
  );
}