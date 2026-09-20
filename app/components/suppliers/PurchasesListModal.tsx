// app/components/suppliers/PurchasesListModal.tsx
"use client";

import { useState } from "react";
import { Trash2, Wallet } from "lucide-react";
import { Modal } from "@/app/components/ui/Modal";
import { Button } from "@/app/components/ui/Button";
import { Badge } from "@/app/components/ui/Badge";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Loader } from "@/app/components/ui/Loader";
import { useToast } from "@/app/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/format";
import { translate, type Dictionary } from "@/lib/i18n";
import type { Purchase, Supplier } from "@/types";

interface PurchasesListModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier;
  purchases: Purchase[];
  isLoading: boolean;
  dictionary: Dictionary;
  // Parent triggers these — they close this modal and open the relevant
  // action modal, so payment/purchase flows are never stacked.
  onRecordPurchase: (supplier: Supplier) => void;
  onPay: (supplier: Supplier, purchaseId: string) => void;
  // Parent owns the delete call + refetch; this modal only confirms.
  onDelete: (purchase: Purchase) => Promise<void>;
}

export function PurchasesListModal({
  isOpen,
  onClose,
  supplier,
  purchases,
  isLoading,
  dictionary,
  onRecordPurchase,
  onPay,
  onDelete,
}: PurchasesListModalProps) {
  const { push } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null
  );

  async function handleConfirmDelete(purchase: Purchase) {
    setDeletingId(purchase.id);
    try {
      await onDelete(purchase);
      setConfirmingDeleteId(null);
    } catch {
      push({
        message: translate(dictionary, "errors.generic"),
        variant: "error",
      });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={translate(dictionary, "suppliers.purchasesList.title", {
        name: supplier.name,
      })}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onRecordPurchase(supplier)}
          >
            {translate(dictionary, "suppliers.card.recordPurchase")}
          </Button>
          <Button type="button" variant="primary" onClick={onClose}>
            {translate(dictionary, "common.close")}
          </Button>
        </>
      }
    >
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader />
        </div>
      ) : purchases.length === 0 ? (
        <EmptyState
          title={translate(dictionary, "suppliers.purchasesList.empty.title")}
          description={translate(
            dictionary,
            "suppliers.purchasesList.empty.description"
          )}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {purchases.map((purchase) => {
            const outstanding = purchase.totalCost - purchase.amountPaid;
            const canDelete = purchase.amountPaid === 0;
            const isConfirming = confirmingDeleteId === purchase.id;
            const isDeleting = deletingId === purchase.id;

            return (
              <li
                key={purchase.id}
                className="rounded-lg border border-border bg-surface p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {formatDate(purchase.date)}
                      {purchase.invoiceNo && (
                        <span className="ms-2 text-xs text-text-muted">
                          #{purchase.invoiceNo}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {purchase.items.length}{" "}
                      {translate(dictionary, "suppliers.purchasesList.items")}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {formatCurrency(purchase.totalCost)}
                    </span>
                    {purchase.paid ? (
                      <Badge variant="success">
                        {translate(
                          dictionary,
                          "suppliers.purchasesList.statusPaid"
                        )}
                      </Badge>
                    ) : (
                      <Badge variant="warning">
                        {translate(
                          dictionary,
                          "suppliers.purchasesList.statusDue",
                          { amount: formatCurrency(outstanding) }
                        )}
                      </Badge>
                    )}
                  </div>
                </div>

                {isConfirming ? (
                  <div className="mt-3 flex flex-col gap-2 rounded-lg bg-danger/5 p-2">
                    <p className="text-xs text-danger">
                      {translate(
                        dictionary,
                        "suppliers.purchasesList.deleteConfirm"
                      )}
                    </p>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setConfirmingDeleteId(null)}
                        disabled={isDeleting}
                      >
                        {translate(dictionary, "common.cancel")}
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => handleConfirmDelete(purchase)}
                        isLoading={isDeleting}
                      >
                        {translate(dictionary, "common.delete")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-2">
                    {outstanding > 0 && (
                      <button
                        type="button"
                        onClick={() => onPay(supplier, purchase.id)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                        {translate(dictionary, "suppliers.card.pay")}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!canDelete}
                      onClick={() => setConfirmingDeleteId(purchase.id)}
                      title={
                        canDelete
                          ? translate(dictionary, "common.delete")
                          : translate(
                              dictionary,
                              "suppliers.purchasesList.cannotDelete"
                            )
                      }
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-danger transition-colors hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {translate(dictionary, "common.delete")}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}