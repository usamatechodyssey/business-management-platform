// app/(dashboard)/pos/POSClient.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShoppingCart, Package } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { useToast } from "@/app/components/ui/Toast";
import { ProductPicker } from "@/app/components/pos/ProductPicker";
import { Cart, type CartItem } from "@/app/components/pos/Cart";
import { PaymentPanel } from "@/app/components/pos/PaymentPanel";
import { SaleReceipt } from "@/app/components/pos/SaleReceipt";
import { QuickAddCustomerModal } from "@/app/components/pos/QuickAddCustomerModal";
import { formatCurrency } from "@/lib/format";
import { translate, type Dictionary, type Locale } from "@/lib/i18n";
import type { Customer, PaymentMethod, Product, Sale } from "@/types";

interface POSClientProps {
  products: Product[];
  customers: Customer[];
  locale: Locale;
  dictionary: Dictionary;
}

function todayInPKT(): string {
  const shifted = new Date(Date.now() + 5 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type MobileTab = "products" | "cart";

export function POSClient({
  products,
  customers,
  locale,
  dictionary,
}: POSClientProps) {
  const router = useRouter();
  const { push: pushToast } = useToast();

  const [items, setItems] = useState<CartItem[]>([]);
  const [sale, setSale] = useState<Sale | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("products");
  // Desktop only: cart panel morphs into the payment panel on checkout,
  // so both never fight for vertical space.
  const [isCheckoutView, setIsCheckoutView] = useState(false);

  const itemCount = items.reduce((sum, i) => sum + i.qty, 0);
  const total = items.reduce((sum, i) => sum + i.qty * i.price, 0);
  const hasItems = items.length > 0;

  // ── Cart operations ──────────────────────────────────────────

  function addToCart(product: Product) {
    setItems((current) => {
      const existing = current.find((i) => i.product.id === product.id);
      if (existing) {
        // Don't exceed stock — server re-validates anyway, but let's
        // avoid an obvious client-side overshoot.
        if (existing.qty >= product.stockQty) return current;
        return current.map((i) =>
          i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...current, { product, qty: 1, price: product.sellPrice }];
    });
  }

  function increaseQty(productId: string) {
    setItems((current) =>
      current.map((i) => {
        if (i.product.id !== productId) return i;
        if (i.qty >= i.product.stockQty) return i;
        return { ...i, qty: i.qty + 1 };
      })
    );
  }

  function decreaseQty(productId: string) {
    setItems((current) =>
      current.flatMap((i) => {
        if (i.product.id !== productId) return [i];
        if (i.qty <= 1) return [];
        return [{ ...i, qty: i.qty - 1 }];
      })
    );
  }

  function removeItem(productId: string) {
    setItems((current) => current.filter((i) => i.product.id !== productId));
  }

  function clearCart() {
    setItems([]);
    setIsCheckoutView(false);
  }

  // ── Cart quantity map for ProductPicker badges ────────────────
  const cartQuantities: Record<string, number> = {};
  for (const item of items) {
    cartQuantities[item.product.id] = item.qty;
  }

  // ── Checkout ──────────────────────────────────────────────────

  function handleCheckout() {
    if (!hasItems) return;
    setIsCheckoutView(true);
    // On mobile, ensure the cart/payment side is visible.
    setMobileTab("cart");
  }

  async function handleSubmitPayment(input: {
    paymentMethod: PaymentMethod;
    customerId?: string;
    amountPaid: number;
  }) {
    const date = todayInPKT();

    const response = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((i) => ({
          productId: i.product.id,
          qty: i.qty,
          price: i.price,
        })),
        customerId: input.customerId ?? "",
        paymentMethod: input.paymentMethod,
        amountPaid: input.amountPaid,
        date,
      }),
    });

    if (response.ok) {
      const body = (await response.json()) as {
        data: { sale: Sale; warning?: string };
      };

      if (body.data.warning === "CREDIT_LIMIT_EXCEEDED") {
        pushToast({
          message: translate(dictionary, "pos.warnings.creditLimitExceeded"),
          variant: "error",
        });
      }

      setSale(body.data.sale);
      setItems([]);
      setIsCheckoutView(false);
      setMobileTab("products");
      router.refresh();
      return;
    }

    let errorBody: { error?: { code?: string; fields?: Record<string, string> } } | null = null;
    try {
      errorBody = (await response.json()) as {
        error?: { code?: string; fields?: Record<string, string> };
      };
    } catch {
      errorBody = null;
    }

    const code = errorBody?.error?.code;
    const fields = errorBody?.error?.fields;

    if (code === "INSUFFICIENT_STOCK") {
      pushToast({
        message: translate(dictionary, "pos.errors.insufficientStock", {
          productName: fields?.productName ?? "",
          available: fields?.available ?? "0",
        }),
        variant: "error",
      });
      // Refresh so stock counts on tiles reflect reality.
      router.refresh();
      return;
    }

    if (code === "CREDIT_LIMIT_EXCEEDED") {
      pushToast({
        message: translate(dictionary, "pos.errors.creditLimitExceeded", {
          limit: formatCurrency(Number(fields?.limit ?? 0)),
        }),
        variant: "error",
      });
      return;
    }

    if (code === "EMPTY_CART") {
      pushToast({
        message: translate(dictionary, "pos.errors.emptyCart"),
        variant: "error",
      });
      return;
    }

    pushToast({
      message: translate(dictionary, "errors.generic"),
      variant: "error",
    });
  }

  // ── Quick-add customer ────────────────────────────────────────
  // The PaymentPanel owns the customer dropdown; when a customer is
  // created inline we need to feed it back. Simplest reliable channel:
  // refresh and let the POSClient re-render with the new customer in the
  // list, but also keep the modal open so the user can select it.
  //
  // We handle this by closing the modal and immediately triggering a
  // router.refresh() — the new customer appears in the dropdown without
  // a manual reload, and the payment panel retains its state.
  function handleCustomerCreated() {
    setIsQuickAddOpen(false);
    // Note: refresh is async; the newly created customer will appear in
    // the next render. The PaymentPanel keeps whatever was selected
    // before, so the shopkeeper just re-selects the new customer.
    router.refresh();
  }

  function handleReceiptClose() {
    setSale(null);
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="flex flex-col lg:grid lg:h-[calc(100dvh-4rem)] lg:grid-cols-[1fr_24rem] lg:overflow-hidden">
      {/* Mobile tab bar — sticky under the fixed header */}
      <div className="sticky top-16 z-20 flex border-b border-border bg-surface lg:hidden">
        <button
          type="button"
          onClick={() => {
            setMobileTab("products");
            setIsCheckoutView(false);
          }}
          aria-pressed={mobileTab === "products"}
          className={[
            "flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-colors",
            mobileTab === "products"
              ? "border-b-2 border-primary text-primary"
              : "text-text-muted hover:bg-surface-muted",
          ].join(" ")}
        >
          <Package className="h-4 w-4" aria-hidden="true" />
          {translate(dictionary, "pos.products.title")}
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("cart")}
          aria-pressed={mobileTab === "cart"}
          className={[
            "flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-colors",
            mobileTab === "cart"
              ? "border-b-2 border-primary text-primary"
              : "text-text-muted hover:bg-surface-muted",
          ].join(" ")}
        >
          <ShoppingCart className="h-4 w-4" aria-hidden="true" />
          {translate(dictionary, "pos.cart.title")}
          {hasItems && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-white">
              {itemCount}
            </span>
          )}
        </button>
      </div>

      {/* Products column */}
      <div
        className={[
          "p-4 lg:overflow-y-auto lg:p-4",
          mobileTab === "cart" ? "hidden lg:block" : "block",
        ].join(" ")}
      >
        <ProductPicker
          products={products}
          cartQuantities={cartQuantities}
          onAddProduct={addToCart}
          dictionary={dictionary}
        />
      </div>

      {/* Cart / payment column */}
      <div
        className={[
          "flex flex-col border-s border-border bg-surface p-4",
          "lg:overflow-y-auto lg:p-4",
          mobileTab === "products" && !isCheckoutView ? "hidden lg:flex" : "flex",
        ].join(" ")}
      >
        {isCheckoutView ? (
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => setIsCheckoutView(false)}
              className="inline-flex items-center gap-1 self-start rounded-md px-2 py-1 text-sm font-medium text-text-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {translate(dictionary, "common.back")}
            </button>
            <PaymentPanel
              total={total}
              customers={customers}
              dictionary={dictionary}
              onSubmit={handleSubmitPayment}
              onRequestQuickAddCustomer={() => setIsQuickAddOpen(true)}
            />
          </div>
        ) : (
          <Cart
            items={items}
            dictionary={dictionary}
            onIncrease={increaseQty}
            onDecrease={decreaseQty}
            onRemove={removeItem}
            onClear={clearCart}
            onCheckout={handleCheckout}
          />
        )}
      </div>

      <QuickAddCustomerModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        dictionary={dictionary}
        onCreated={handleCustomerCreated}
      />

      <SaleReceipt
        sale={sale}
        locale={locale}
        dictionary={dictionary}
        onClose={handleReceiptClose}
      />
    </div>
  );
}