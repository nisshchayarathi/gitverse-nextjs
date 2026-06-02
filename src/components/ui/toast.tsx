// src/components/ui/Toast.tsx
"use client";

import { useEffect, useState } from "react";
import { Toast as ToastType } from "@/hooks/useToast";

interface ToastProps {
  toast: ToastType;
  onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger entrance animation on mount
    const enterTimer = setTimeout(() => setVisible(true), 10);
    // Trigger exit animation just before auto-dismiss
    const exitTimer = setTimeout(() => setVisible(false), 2600);
    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
    };
  }, []);

  const isSuccess = toast.type === "success";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        transform: visible ? "translateX(0)" : "translateX(110%)",
        opacity: visible ? 1 : 0,
        transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease",
      }}
      className={[
        "flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border min-w-[220px] max-w-xs",
        "bg-slate-900 text-white",
        isSuccess
          ? "border-emerald-500/40"
          : "border-red-500/40",
      ].join(" ")}
    >
      {/* Icon */}
      <span
        className={[
          "flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
          isSuccess
            ? "bg-emerald-500/20 text-emerald-400"
            : "bg-red-500/20 text-red-400",
        ].join(" ")}
        aria-hidden="true"
      >
        {isSuccess ? (
          <svg viewBox="0 0 16 16" fill="none" width="14" height="14" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M3 8.5L6.5 12L13 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" fill="none" width="14" height="14" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M8 4V8M8 11.5V12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        )}
      </span>

      {/* Message */}
      <span className="text-sm font-medium leading-snug flex-1">{toast.message}</span>

      {/* Close button */}
      <button
        onClick={() => onRemove(toast.id)}
        aria-label="Dismiss notification"
        className="flex-shrink-0 text-slate-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 rounded"
      >
        <svg viewBox="0 0 16 16" fill="none" width="14" height="14" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M4 4L12 12M12 4L4 12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastType[];
  onRemove: (id: string) => void;
}

/**
 * ToastContainer — place once in your layout or page root.
 * Renders all active toasts in the bottom-right corner.
 *
 * @example
 * const { toasts, addToast, removeToast } = useToast();
 * return (
 *   <>
 *     <YourPage />
 *     <ToastContainer toasts={toasts} onRemove={removeToast} />
 *   </>
 * );
 */
export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}
