// app/(dashboard)/customers/CustomersClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { Modal } from "@/app/components/ui/Modal";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { useToast } from "@/app/components/ui/Toast";
import { CustomerCard } from "@/app/components/customers/CustomerCard";
import { CustomerFormModal } from "@/app/components/customers/CustomerFormModal";
import { PaymentRecordModal } from "@/app/components/customers/PaymentRecordModal";
import { LedgerModal } from "@/app/components/customers/LedgerModal";
import { ReminderModal } from "@/app/components/whatsapp/ReminderModal";
import { translate, type Dictionary, type Locale } from "@/lib/i18n";
import type { Customer, KhataSettings, LedgerEntry } from "@/types";

interface CustomersClientProps {
  customers: Customer[];
  khataSettings: KhataSettings;
  businessName: string;
  locale: Locale;
  dictionary: Dictionary;
}

const SEARCH_DEBOUNCE_MS = 300;

export function CustomersClient({
  customers,
  khataSettings,
  businessName,
  locale,
  dictionary,
}: CustomersClientProps) {
  const router = useRouter();
  const { push: pushToast } = useToast();

  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // ── Modal state ──────────────────────────────────────────────
  // customerFormTarget: undefined = closed, null = create, Customer = edit
  const [customerFormTarget, setCustomerFormTarget] = useState<
    Customer | null | undefined
  >(undefined);

  const [paymentTarget, setPaymentTarget] = useState<Customer | null>(null);
  const [reminderTarget, setReminderTarget] = useState<Customer | null>(null);

  const [ledgerTarget, setLedgerTarget] = useState<Customer | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false);

  // Debounced client-side search — customers list is small.
  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedQuery(searchInput.trim()),
      SEARCH_DEBOUNCE_MS
    );
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const filteredCustomers = useMemo(() => {
    if (!debouncedQuery) return customers;
    const needle = debouncedQuery.toLowerCase();
    return customers.filter((customer) => {
      return (
        customer.name.toLowerCase().includes(needle) ||
        customer.phone.toLowerCase().includes(needle) ||
        (customer.tag ?? "").toLowerCase().includes(needle)
      );
    });
  }, [customers, debouncedQuery]);

  const hasFilter = debouncedQuery.length > 0;

  // ── Handlers: customer form ──────────────────────────────────
  function handleAddCustomer() {
    setCustomerFormTarget(null);
  }

  function handleEditCustomer(customer: Customer) {
    setCustomerFormTarget(customer);
  }

  function handleCustomerFormSuccess() {
    setCustomerFormTarget(undefined);
    router.refresh();
  }

  // ── Handlers: ledger ─────────────────────────────────────────
  async function handleViewLedger(customer: Customer) {
    setLedgerTarget(customer);
    setLedgerEntries([]);
    setIsLoadingLedger(true);
    try {
      const response = await fetch(`/api/customers/${customer.id}/ledger`);
      if (!response.ok) {
        throw new Error(`Failed to load ledger (${response.status})`);
      }
      const body = (await response.json()) as {
        data: { customer: Customer; entries: LedgerEntry[] };
      };
      setLedgerEntries(body.data.entries);
    } catch {
      pushToast({
        message: translate(dictionary, "errors.generic"),
        variant: "error",
      });
      setLedgerTarget(null);
    } finally {
      setIsLoadingLedger(false);
    }
  }

  // ── Handlers: payment ────────────────────────────────────────
  function handleRecordPayment(customer: Customer) {
    // Close the ledger modal first so we never stack modals.
    setLedgerTarget(null);
    setPaymentTarget(customer);
  }

  function handlePaymentSuccess() {
    setPaymentTarget(null);
    // router.refresh() re-runs the server component, so the customers
    // list (and each card's totalDue) reflects the new balance. Any
    // ledger refetch happens naturally next time the modal is opened.
    router.refresh();
  }

  // ── Handlers: reminder ───────────────────────────────────────
  function handleRemind(customer: Customer) {
    // Same modal-stacking rule as payment.
    setLedgerTarget(null);
    setReminderTarget(customer);
  }

  // ── Handlers: customer delete ────────────────────────────────
  async function confirmDeleteCustomer() {
    if (!deleteTarget || isDeletingCustomer) return;
    setIsDeletingCustomer(true);
    try {
      const response = await fetch(`/api/customers/${deleteTarget.id}`, {
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
        if (body?.error?.code === "CUSTOMER_HAS_LEDGER_ENTRIES") {
          pushToast({
            message: translate(
              dictionary,
              "customers.errors.hasLedgerEntries"
            ),
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
        message: translate(dictionary, "customers.deleted"),
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
      setIsDeletingCustomer(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {translate(dictionary, "customers.title")}
          </h1>
          <p className="text-sm text-text-muted">
            {translate(dictionary, "customers.subtitle")}
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={handleAddCustomer}
          leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
        >
          {translate(dictionary, "customers.addCustomer")}
        </Button>
      </div>

      {/* Search */}
      <div className="rounded-xl border border-border bg-surface p-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={translate(dictionary, "customers.searchPlaceholder")}
            aria-label={translate(dictionary, "customers.searchPlaceholder")}
            className="h-11 w-full rounded-lg border border-border bg-surface ps-9 pe-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          {hasFilter && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              aria-label={translate(dictionary, "inventory.filters.clear")}
              className="absolute inset-e-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-text-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {customers.length === 0 ? (
        <EmptyState
          title={translate(dictionary, "customers.empty.title")}
          description={translate(dictionary, "customers.empty.description")}
          action={
            <Button
              type="button"
              variant="primary"
              onClick={handleAddCustomer}
            >
              {translate(dictionary, "customers.addCustomer")}
            </Button>
          }
        />
      ) : filteredCustomers.length === 0 ? (
        <EmptyState
          title={translate(dictionary, "customers.empty.filterTitle")}
          description={translate(
            dictionary,
            "customers.empty.filterDescription"
          )}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filteredCustomers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              khataSettings={khataSettings}
              locale={locale}
              dictionary={dictionary}
              onViewLedger={handleViewLedger}
              onRecordPayment={handleRecordPayment}
              onRemind={handleRemind}
              onEdit={handleEditCustomer}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────── */}

      <CustomerFormModal
        isOpen={customerFormTarget !== undefined}
        onClose={() => setCustomerFormTarget(undefined)}
        customer={customerFormTarget ?? null}
        khataSettings={khataSettings}
        dictionary={dictionary}
        onSuccess={handleCustomerFormSuccess}
      />

      {paymentTarget && (
        <PaymentRecordModal
          isOpen={true}
          onClose={() => setPaymentTarget(null)}
          customer={paymentTarget}
          dictionary={dictionary}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {ledgerTarget && (
        <LedgerModal
          isOpen={true}
          onClose={() => setLedgerTarget(null)}
          customer={ledgerTarget}
          entries={ledgerEntries}
          isLoading={isLoadingLedger}
          locale={locale}
          dictionary={dictionary}
          onRecordPayment={handleRecordPayment}
          onRemind={handleRemind}
        />
      )}

      {reminderTarget && (
        <ReminderModal
          isOpen={true}
          onClose={() => setReminderTarget(null)}
          customer={reminderTarget}
          businessName={businessName}
          khataSettings={khataSettings}
          dictionary={dictionary}
        />
      )}

      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={translate(dictionary, "customers.deleteConfirm.title")}
        closeOnBackdropClick={!isDeletingCustomer}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeletingCustomer}
            >
              {translate(dictionary, "customers.deleteConfirm.cancel")}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={confirmDeleteCustomer}
              isLoading={isDeletingCustomer}
            >
              {translate(dictionary, "customers.deleteConfirm.confirm")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-foreground">
          {translate(dictionary, "customers.deleteConfirm.description")}
        </p>
      </Modal>
    </div>
  );
}