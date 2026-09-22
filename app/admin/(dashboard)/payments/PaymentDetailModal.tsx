// app/admin/(dashboard)/payments/PaymentDetailModal.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, MessageCircle, X } from "lucide-react";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Badge } from "@/app/components/ui/Badge";
import { useToast } from "@/app/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/format";
import { translate, type Dictionary, type Locale } from "@/lib/i18n";
import { normalizePhoneForWhatsApp } from "@/lib/whatsapp";
import type { Payment } from "@/types";

interface PaymentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment;
  locale: Locale;
  dictionary: Dictionary;
}

function methodLabelKey(method: Payment["method"]) {
  if (method === "jazzcash") return "admin.payments.methods.jazzcash" as const;
  if (method === "easypaisa") return "admin.payments.methods.easypaisa" as const;
  if (method === "bank") return "admin.payments.methods.bank" as const;
  return "admin.payments.methods.other" as const;
}

function statusLabelKey(status: Payment["status"]) {
  if (status === "verified") return "admin.payments.status.verified" as const;
  if (status === "rejected") return "admin.payments.status.rejected" as const;
  return "admin.payments.status.pending" as const;
}

export function PaymentDetailModal({
  isOpen,
  onClose,
  payment,
  locale,
  dictionary,
}: PaymentDetailModalProps) {
  const router = useRouter();
  const { push } = useToast();

  const [verifyOpen, setVerifyOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const isPending = payment.status === "pending";

  async function handleVerify() {
    setIsBusy(true);
    try {
      const response = await fetch(
        `/api/admin/payments/${payment.id}/verify`,
        { method: "POST" }
      );
      if (!response.ok) throw new Error("Verify failed");
      push({
        message: translate(dictionary, "admin.payments.verifiedToast"),
        variant: "success",
      });
      setVerifyOpen(false);
      onClose();
      router.refresh();
    } catch {
      push({
        message: translate(dictionary, "errors.generic"),
        variant: "error",
      });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) return;
    setIsBusy(true);
    try {
      const response = await fetch(
        `/api/admin/payments/${payment.id}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: rejectReason.trim() }),
        }
      );
      if (!response.ok) throw new Error("Reject failed");
      push({
        message: translate(dictionary, "admin.payments.rejectedToast"),
        variant: "success",
      });
      setRejectOpen(false);
      onClose();
      router.refresh();
    } catch {
      push({
        message: translate(dictionary, "errors.generic"),
        variant: "error",
      });
    } finally {
      setIsBusy(false);
    }
  }

  // WhatsApp deep link for chatting with the customer about this payment.
  const whatsappLink = (() => {
    const phone = normalizePhoneForWhatsApp(payment.ownerPhone);
    if (!phone) return null;
    const msg = `Assalam-o-Alaikum ${payment.ownerName}, regarding payment ${payment.reference}`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  })();

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={translate(dictionary, "admin.payments.detail.title", {
          reference: payment.reference,
        })}
        closeOnBackdropClick={!isBusy}
        footer={
          isPending ? (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={isBusy}
              >
                {translate(dictionary, "admin.payments.detail.close")}
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => setRejectOpen(true)}
                disabled={isBusy}
                leadingIcon={<X className="h-4 w-4" aria-hidden="true" />}
              >
                {translate(dictionary, "admin.payments.detail.reject")}
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => setVerifyOpen(true)}
                disabled={isBusy}
                leadingIcon={<Check className="h-4 w-4" aria-hidden="true" />}
              >
                {translate(dictionary, "admin.payments.detail.verify")}
              </Button>
            </>
          ) : (
            <Button type="button" variant="secondary" onClick={onClose}>
              {translate(dictionary, "admin.payments.detail.close")}
            </Button>
          )
        }
      >
        <div className="flex flex-col gap-4">
          {/* Status badge */}
          <div>
            <Badge
              variant={
                payment.status === "verified"
                  ? "success"
                  : payment.status === "rejected"
                    ? "danger"
                    : "warning"
              }
            >
              {translate(dictionary, statusLabelKey(payment.status))}
            </Badge>
          </div>

          {/* Detail rows */}
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Detail
              label={translate(
                dictionary,
                "admin.payments.detail.businessLabel"
              )}
            >
              {payment.businessName}
            </Detail>
            <Detail
              label={translate(
                dictionary,
                "admin.payments.detail.ownerLabel"
              )}
            >
              {payment.ownerName}
            </Detail>
            <Detail
              label={translate(
                dictionary,
                "admin.payments.detail.ownerPhoneLabel"
              )}
            >
              {payment.ownerPhone}
            </Detail>
            <Detail
              label={translate(dictionary, "admin.payments.detail.planLabel")}
            >
              {payment.plan} × {payment.months}
            </Detail>
            <Detail
              label={translate(dictionary, "admin.payments.detail.amountLabel")}
            >
              {formatCurrency(payment.amount)}
            </Detail>
            <Detail
              label={translate(dictionary, "admin.payments.detail.methodLabel")}
            >
              {translate(dictionary, methodLabelKey(payment.method))}
            </Detail>
            {payment.transactionId && (
              <Detail
                label={translate(
                  dictionary,
                  "admin.payments.detail.transactionIdLabel"
                )}
              >
                <span className="font-mono">{payment.transactionId}</span>
              </Detail>
            )}
            <Detail
              label={translate(dictionary, "admin.payments.detail.paidOnLabel")}
            >
              {formatDate(payment.paidAt, locale)}
            </Detail>
            <Detail
              label={translate(
                dictionary,
                "admin.payments.detail.submittedLabel"
              )}
            >
              {formatDate(payment.createdAt, locale)}
            </Detail>
          </dl>

          {payment.notes && (
            <div className="rounded-lg bg-surface-muted px-3 py-2">
              <p className="text-xs text-text-muted">
                {translate(dictionary, "admin.payments.detail.notesLabel")}
              </p>
              <p className="mt-0.5 text-sm text-foreground">{payment.notes}</p>
            </div>
          )}

          {payment.status === "rejected" && payment.rejectionReason && (
            <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              <strong>
                {translate(
                  dictionary,
                  "admin.payments.detail.rejectionReasonLabel"
                )}
                :
              </strong>{" "}
              {payment.rejectionReason}
            </div>
          )}

          {/* WhatsApp button */}
          {whatsappLink && (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 self-start rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              {translate(dictionary, "admin.payments.detail.openWhatsApp")}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          )}
        </div>
      </Modal>

      {/* Verify confirmation */}
      <Modal
        isOpen={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        title={translate(dictionary, "admin.payments.verifyModal.title")}
        closeOnBackdropClick={!isBusy}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setVerifyOpen(false)}
              disabled={isBusy}
            >
              {translate(dictionary, "admin.payments.verifyModal.cancel")}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleVerify}
              isLoading={isBusy}
            >
              {translate(dictionary, "admin.payments.verifyModal.confirm")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-foreground">
          {translate(dictionary, "admin.payments.verifyModal.description", {
            months: payment.months,
            plan: payment.plan,
          })}
        </p>
      </Modal>

      {/* Reject modal */}
      <Modal
        isOpen={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title={translate(dictionary, "admin.payments.rejectModal.title")}
        closeOnBackdropClick={!isBusy}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRejectOpen(false)}
              disabled={isBusy}
            >
              {translate(dictionary, "admin.payments.rejectModal.cancel")}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleReject}
              isLoading={isBusy}
              disabled={!rejectReason.trim()}
            >
              {translate(dictionary, "admin.payments.rejectModal.confirm")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-foreground">
          {translate(dictionary, "admin.payments.rejectModal.description")}
        </p>
        <div className="mt-4">
          <Input
            label={translate(
              dictionary,
              "admin.payments.rejectModal.reasonLabel"
            )}
            name="reason"
            type="text"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            helperText={translate(
              dictionary,
              "admin.payments.rejectModal.reasonPlaceholder"
            )}
            disabled={isBusy}
            required
          />
        </div>
      </Modal>
    </>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{children}</dd>
    </div>
  );
}