// components/ui/Toast.tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type ToastVariant = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface PushToastInput {
  message: string;
  variant?: ToastVariant;
  durationMs?: number;
}

interface ToastContextValue {
  push: (input: PushToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: "bg-success text-white",
  error: "bg-danger text-white",
  info: "bg-surface text-foreground border border-border",
};

const DEFAULT_DURATION_MS = 4000;

// Mount <ToastProvider> once, at the root layout (app/layout.tsx — F6),
// wrapping the whole app so useToast() works anywhere in the tree.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    ({ message, variant = "info", durationMs = DEFAULT_DURATION_MS }: PushToastInput) => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { id, message, variant }]);
      window.setTimeout(() => dismiss(id), durationMs);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div className="fixed bottom-4 end-4 z-50 flex flex-col gap-2">
            {toasts.map((toast) => (
              <div
                key={toast.id}
                role="status"
                className={[
                  "min-w-60 max-w-sm rounded-lg px-4 py-3 text-sm shadow-lg",
                  VARIANT_CLASSES[toast.variant],
                ].join(" ")}
              >
                {toast.message}
              </div>
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast() must be used inside a <ToastProvider>.");
  }
  return context;
}