// app/components/customers/LedgerModal.tsx
"use client";

import { MessageCircle, Wallet } from "lucide-react";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { Loader } from "@/app/components/ui/Loader";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { LedgerTable } from "./LedgerTable";
import { formatCurrency } from "@/lib/format";
import { translate, type Dictionary, type Locale } from "@/lib/i18n";
import type { Customer, LedgerEntry } from "@/types";

interface LedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  entries: LedgerEntry[];
  isLoading: boolean;
  locale: Locale;
  dictionary: Dictionary;
  // Parent closes this and opens PaymentRecordModal — modals never stack.
  onRecordPayment: (customer: Customer) => void;
  // Same modal-stacking rule: parent closes this and opens ReminderModal.
  onRemind: (customer: Customer) => void;
}

export function LedgerModal({
  isOpen,
  onClose,
  customer,
  entries,
  isLoading,
  locale,
  dictionary,
  onRecordPayment,
  onRemind,
}: LedgerModalProps) {
  const hasDue = customer.totalDue > 0;
  const khataTooltip = translate(dictionary, "customers.khataTooltip");

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={translate(dictionary, "customers.ledger.title", {
        name: customer.name,
      })}
            footer={
        <>
          {hasDue && (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onRemind(customer)}
                leadingIcon={
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                }
              >
                {translate(dictionary, "customers.card.remind")}
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => onRecordPayment(customer)}
                leadingIcon={
                  <Wallet className="h-4 w-4" aria-hidden="true" />
                }
              >
                {translate(dictionary, "customers.card.recordPayment")}
              </Button>
            </>
          )}
          <Button type="button" variant="secondary" onClick={onClose}>
            {translate(dictionary, "common.close")}
          </Button>
        </>
      }
    >
      {/* Header summary — plain-language info tooltip lives on the running
          balance label so a first-time user understands what they're
          looking at without leaving the modal. */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2">
        <span
          className="text-sm text-text-muted"
          title={khataTooltip}
        >
          {translate(dictionary, "customers.ledger.runningBalance", {
            amount: formatCurrency(customer.totalDue),
          })}
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          title={translate(dictionary, "customers.ledger.empty.title")}
          description={translate(
            dictionary,
            "customers.ledger.empty.description"
          )}
        />
      ) : (
        <LedgerTable
          entries={entries}
          locale={locale}
          dictionary={dictionary}
        />
      )}
    </Modal>
  );
}