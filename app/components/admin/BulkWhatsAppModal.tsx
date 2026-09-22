// app/components/admin/BulkWhatsAppModal.tsx
//
// Sequentially opens WhatsApp with a pre-filled message for each
// selected tenant. The admin taps Send in WhatsApp and returns here
// to advance to the next. This manual cadence keeps us within
// WhatsApp's terms and works without the Business API.
//
// Placeholder substitution supports: {ownerName}, {businessName},
// {expiryDate}, {renewalUrl}.

"use client";

import { useState } from "react";
import { Check, ExternalLink, MessageCircle, SkipForward } from "lucide-react";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { formatDate } from "@/lib/format";
import { translate, type Dictionary, type Locale } from "@/lib/i18n";
import { normalizePhoneForWhatsApp } from "@/lib/whatsapp";
import type { Business } from "@/types";

interface BulkWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenants: Business[];
  template: string;
  renewalUrl: string;
  locale: Locale;
  dictionary: Dictionary;
}

function substituteTemplate(
  template: string,
  tenant: Business,
  renewalUrl: string,
  locale: Locale
): string {
  return template
    .replace(/\{ownerName\}/g, tenant.ownerName)
    .replace(/\{businessName\}/g, tenant.name)
    .replace(
      /\{expiryDate\}/g,
      tenant.subscription
        ? formatDate(tenant.subscription.expiresAt, locale)
        : "—"
    )
    .replace(/\{renewalUrl\}/g, renewalUrl);
}

export function BulkWhatsAppModal({
  isOpen,
  onClose,
  tenants,
  template,
  renewalUrl,
  locale,
  dictionary,
}: BulkWhatsAppModalProps) {
  const [index, setIndex] = useState(0);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const current = tenants[index];
  const total = tenants.length;
  const done = index >= total;

  function handleOpenWhatsApp() {
    if (!current) return;
    const phone = normalizePhoneForWhatsApp(current.phone);
    if (!phone) return;

    const message = substituteTemplate(template, current, renewalUrl, locale);
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
    setSentIds((current) => new Set(current).add(tenants[index]!.id));
  }

  function handleNext() {
    setIndex((i) => i + 1);
  }

  function handleReset() {
    setIndex(0);
    setSentIds(new Set());
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={translate(dictionary, "admin.tenants.bulk.title")}
      closeOnBackdropClick={false}
      footer={
        done ? (
          <>
            <Button type="button" variant="secondary" onClick={handleReset}>
              {translate(dictionary, "admin.tenants.bulk.restart")}
            </Button>
            <Button type="button" variant="primary" onClick={onClose}>
              {translate(dictionary, "common.close")}
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
            >
              {translate(dictionary, "common.cancel")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleNext}
              leadingIcon={
                <SkipForward className="h-4 w-4" aria-hidden="true" />
              }
            >
              {translate(dictionary, "admin.tenants.bulk.skip")}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleOpenWhatsApp}
              leadingIcon={
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
              }
            >
              {translate(dictionary, "admin.tenants.bulk.open")}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
            <Check className="h-7 w-7" aria-hidden="true" />
          </div>
          <p className="text-base font-semibold text-foreground">
            {translate(dictionary, "admin.tenants.bulk.doneTitle", {
              count: sentIds.size,
            })}
          </p>
          <p className="text-sm text-text-muted">
            {translate(dictionary, "admin.tenants.bulk.doneDescription")}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Progress */}
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">
              {translate(dictionary, "admin.tenants.bulk.progress", {
                current: index + 1,
                total,
              })}
            </span>
            <span className="text-text-muted">
              {translate(dictionary, "admin.tenants.bulk.sentCount", {
                count: sentIds.size,
              })}
            </span>
          </div>

          {/* Current tenant */}
          <div className="rounded-lg border border-border bg-surface-muted p-3">
            <p className="text-sm font-semibold text-foreground">
              {current?.name}
            </p>
            <p className="mt-0.5 text-xs text-text-muted">
              {current?.ownerName} · {current?.phone}
            </p>
            {current?.subscription && (
              <p className="mt-1 text-xs text-text-muted">
                {translate(dictionary, "admin.tenants.bulk.expiresOn")}:{" "}
                {formatDate(current.subscription.expiresAt, locale)}
              </p>
            )}
          </div>

          {/* Message preview */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-text-muted">
              {translate(dictionary, "admin.tenants.bulk.previewLabel")}
            </p>
            <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm whitespace-pre-wrap">
              {current
                ? substituteTemplate(template, current, renewalUrl, locale)
                : ""}
            </div>
          </div>

          <p className="text-xs text-text-muted">
            <ExternalLink
              className="me-1 inline h-3 w-3 align-text-bottom"
              aria-hidden="true"
            />
            {translate(dictionary, "admin.tenants.bulk.helper")}
          </p>
        </div>
      )}
    </Modal>
  );
}