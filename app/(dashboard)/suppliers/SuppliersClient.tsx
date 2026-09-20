// app/(dashboard)/suppliers/SuppliersClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { Modal } from "@/app/components/ui/Modal";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { useToast } from "@/app/components/ui/Toast";
import { SupplierCard } from "@/app/components/suppliers/SupplierCard";
import { SupplierFormModal } from "@/app/components/suppliers/SupplierFormModal";
import { PurchaseFormModal } from "@/app/components/suppliers/PurchaseFormModal";
import { PaymentModal } from "@/app/components/suppliers/PaymentModal";
import { PurchasesListModal } from "@/app/components/suppliers/PurchasesListModal";
import { translate, type Dictionary } from "@/lib/i18n";
import type { Product, Purchase, Supplier } from "@/types";

interface SuppliersClientProps {
  suppliers: Supplier[];
  // All active products, used by PurchaseFormModal's line-item picker.
  products: Product[];
  dictionary: Dictionary;
}

const SEARCH_DEBOUNCE_MS = 300;

export function SuppliersClient({
  suppliers,
  products,
  dictionary,
}: SuppliersClientProps) {
  const router = useRouter();
  const { push: pushToast } = useToast();

  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // ── Modal state ──────────────────────────────────────────────
  // supplierFormTarget: undefined = closed, null = create, Supplier = edit
  const [supplierFormTarget, setSupplierFormTarget] = useState<
    Supplier | null | undefined
  >(undefined);

  const [purchaseFormTarget, setPurchaseFormTarget] =
    useState<Supplier | null>(null);

  const [purchasesListTarget, setPurchasesListTarget] =
    useState<Supplier | null>(null);

  const [paymentTarget, setPaymentTarget] = useState<{
    supplier: Supplier;
    initialPurchaseId?: string;
  } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [isDeletingSupplier, setIsDeletingSupplier] = useState(false);

  // Purchases of whichever supplier is currently loaded into a modal.
  const [modalPurchases, setModalPurchases] = useState<Purchase[]>([]);
  const [isLoadingModalPurchases, setIsLoadingModalPurchases] = useState(false);

  // Debounced client-side search — the list is small enough that a
  // network round-trip per keystroke isn't warranted.
  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedQuery(searchInput.trim()),
      SEARCH_DEBOUNCE_MS
    );
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const filteredSuppliers = useMemo(() => {
    if (!debouncedQuery) return suppliers;
    const needle = debouncedQuery.toLowerCase();
    return suppliers.filter((supplier) => {
      return (
        supplier.name.toLowerCase().includes(needle) ||
        supplier.phone.toLowerCase().includes(needle) ||
        (supplier.contactPerson ?? "").toLowerCase().includes(needle)
      );
    });
  }, [suppliers, debouncedQuery]);

  const hasFilter = debouncedQuery.length > 0;

  // ── Fetch helper ─────────────────────────────────────────────
  async function fetchSupplierPurchases(
    supplierId: string
  ): Promise<Purchase[]> {
    const response = await fetch(`/api/suppliers/${supplierId}/purchases`);
    if (!response.ok) {
      throw new Error(`Failed to load purchases (${response.status})`);
    }
    const body = (await response.json()) as {
      data: { purchases: Purchase[] };
    };
    return body.data.purchases;
  }

  // ── Handlers: supplier form ──────────────────────────────────
  function handleAddSupplier() {
    setSupplierFormTarget(null);
  }

  function handleEditSupplier(supplier: Supplier) {
    setSupplierFormTarget(supplier);
  }

  function handleSupplierFormSuccess() {
    setSupplierFormTarget(undefined);
    router.refresh();
  }

  // ── Handlers: purchases list ─────────────────────────────────
  async function handleViewPurchases(supplier: Supplier) {
    setPurchasesListTarget(supplier);
    setModalPurchases([]);
    setIsLoadingModalPurchases(true);
    try {
      const purchases = await fetchSupplierPurchases(supplier.id);
      setModalPurchases(purchases);
    } catch {
      pushToast({
        message: translate(dictionary, "errors.generic"),
        variant: "error",
      });
      setPurchasesListTarget(null);
    } finally {
      setIsLoadingModalPurchases(false);
    }
  }

  async function handleDeletePurchase(purchase: Purchase) {
    const response = await fetch(`/api/purchases/${purchase.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(`Delete failed (${response.status})`);
    }
    // Refresh the list so the deleted row disappears and totalOwed from
    // the parent list stays consistent.
    if (purchasesListTarget) {
      const purchases = await fetchSupplierPurchases(purchasesListTarget.id);
      setModalPurchases(purchases);
    }
    router.refresh();
  }

  // ── Handlers: purchase form ──────────────────────────────────
  function handleRecordPurchase(supplier: Supplier) {
    // Close any open list modal so we never stack modals.
    setPurchasesListTarget(null);
    setPurchaseFormTarget(supplier);
  }

  function handlePurchaseFormSuccess() {
    setPurchaseFormTarget(null);
    router.refresh();
  }

  // ── Handlers: payment ────────────────────────────────────────
  async function handlePayFromCard(supplier: Supplier) {
    setPaymentTarget({ supplier });
    setModalPurchases([]);
    setIsLoadingModalPurchases(true);
    try {
      const purchases = await fetchSupplierPurchases(supplier.id);
      setModalPurchases(purchases);
    } catch {
      pushToast({
        message: translate(dictionary, "errors.generic"),
        variant: "error",
      });
      setPaymentTarget(null);
    } finally {
      setIsLoadingModalPurchases(false);
    }
  }

  function handlePayFromList(supplier: Supplier, purchaseId: string) {
    // Reuse the already-fetched purchases from the list modal — no refetch.
    setPurchasesListTarget(null);
    setPaymentTarget({ supplier, initialPurchaseId: purchaseId });
  }

  function handlePaymentSuccess() {
    setPaymentTarget(null);
    // Refresh purchases (they were modified) and the supplier list (owed
    // total changed) — but only if the list modal isn't about to reopen,
    // which it isn't because we closed it above.
    setModalPurchases([]);
    router.refresh();
  }

  // ── Handlers: supplier delete ────────────────────────────────
  async function confirmDeleteSupplier() {
    if (!deleteTarget || isDeletingSupplier) return;
    setIsDeletingSupplier(true);
    try {
      const response = await fetch(`/api/suppliers/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        let body: { error?: { code?: string } } | null = null;
        try {
          body = (await response.json()) as {
            error?: { code?: string };
          };
        } catch {
          body = null;
        }
        if (body?.error?.code === "SUPPLIER_HAS_PURCHASES") {
          pushToast({
            message: translate(dictionary, "suppliers.errors.hasPurchases"),
            variant: "error",
          });
        } else {
          pushToast({
            message: translate(dictionary, "errors.generic"),
            variant: "error",
          });
        }
        setDeleteTarget(null);
        return;
      }
      pushToast({
        message: translate(dictionary, "suppliers.deleted"),
        variant: "success",
      });
      setDeleteTarget(null);
      router.refresh();
    } catch {
      pushToast({
        message: translate(dictionary, "errors.generic"),
        variant: "error",
      });
    } finally {
      setIsDeletingSupplier(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {translate(dictionary, "suppliers.title")}
          </h1>
          <p className="text-sm text-text-muted">
            {translate(dictionary, "suppliers.subtitle")}
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={handleAddSupplier}
          leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
        >
          {translate(dictionary, "suppliers.addSupplier")}
        </Button>
      </div>

      {/* Search */}
      <div className="rounded-xl border border-border bg-surface p-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={translate(dictionary, "suppliers.searchPlaceholder")}
            aria-label={translate(dictionary, "suppliers.searchPlaceholder")}
            className="h-11 w-full rounded-lg border border-border bg-surface ps-9 pe-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          {hasFilter && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              aria-label={translate(dictionary, "inventory.filters.clear")}
              className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-text-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {suppliers.length === 0 ? (
        <EmptyState
          title={translate(dictionary, "suppliers.empty.title")}
          description={translate(dictionary, "suppliers.empty.description")}
          action={
            <Button
              type="button"
              variant="primary"
              onClick={handleAddSupplier}
            >
              {translate(dictionary, "suppliers.addSupplier")}
            </Button>
          }
        />
      ) : filteredSuppliers.length === 0 ? (
        <EmptyState
          title={translate(dictionary, "suppliers.empty.filterTitle")}
          description={translate(
            dictionary,
            "suppliers.empty.filterDescription"
          )}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filteredSuppliers.map((supplier) => (
            <SupplierCard
              key={supplier.id}
              supplier={supplier}
              dictionary={dictionary}
              onViewPurchases={handleViewPurchases}
              onRecordPurchase={handleRecordPurchase}
              onPay={handlePayFromCard}
              onEdit={handleEditSupplier}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────── */}

      <SupplierFormModal
        isOpen={supplierFormTarget !== undefined}
        onClose={() => setSupplierFormTarget(undefined)}
        supplier={supplierFormTarget ?? null}
        dictionary={dictionary}
        onSuccess={handleSupplierFormSuccess}
      />

      {purchaseFormTarget && (
        <PurchaseFormModal
          isOpen={true}
          onClose={() => setPurchaseFormTarget(null)}
          supplier={purchaseFormTarget}
          products={products}
          dictionary={dictionary}
          onSuccess={handlePurchaseFormSuccess}
        />
      )}

      {purchasesListTarget && (
        <PurchasesListModal
          isOpen={true}
          onClose={() => setPurchasesListTarget(null)}
          supplier={purchasesListTarget}
          purchases={modalPurchases}
          isLoading={isLoadingModalPurchases}
          dictionary={dictionary}
          onRecordPurchase={handleRecordPurchase}
          onPay={handlePayFromList}
          onDelete={handleDeletePurchase}
        />
      )}

      {paymentTarget && (
        <PaymentModal
          isOpen={true}
          onClose={() => setPaymentTarget(null)}
          supplier={paymentTarget.supplier}
          purchases={modalPurchases}
          initialPurchaseId={paymentTarget.initialPurchaseId}
          isLoading={isLoadingModalPurchases}
          dictionary={dictionary}
          onSuccess={handlePaymentSuccess}
        />
      )}

      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={translate(dictionary, "suppliers.deleteConfirm.title")}
        closeOnBackdropClick={!isDeletingSupplier}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeletingSupplier}
            >
              {translate(dictionary, "suppliers.deleteConfirm.cancel")}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={confirmDeleteSupplier}
              isLoading={isDeletingSupplier}
            >
              {translate(dictionary, "suppliers.deleteConfirm.confirm")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-foreground">
          {translate(dictionary, "suppliers.deleteConfirm.description")}
        </p>
      </Modal>
    </div>
  );
}