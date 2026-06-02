// src/components/ui/CopyUrlButton.tsx
"use client";

import { useState, useCallback } from "react";

interface CopyUrlButtonProps {
  /** The URL to copy. Defaults to the current window location href. */
  url?: string;
  /** Optional label override. Defaults to "Copy Link". */
  label?: string;
  /** Optional className for outer wrapper (for layout placement). */
  className?: string;
  /** Callback fired after a successful copy. */
  onSuccess?: () => void;
  /** Callback fired when copy fails. */
  onError?: () => void;
}

type CopyState = "idle" | "copied" | "error";

/**
 * CopyUrlButton
 *
 * A one-click button that copies the current (or provided) URL to the
 * clipboard. Shows inline success/error feedback via icon + label change,
 * and fires optional callbacks so a parent can display a toast.
 *
 * Keyboard accessible: activates on Enter and Space.
 * Screen-reader accessible: uses aria-live to announce state changes.
 *
 * @example — standalone, no toast
 * <CopyUrlButton />
 *
 * @example — with parent toast
 * const { addToast } = useToast();
 * <CopyUrlButton
 *   onSuccess={() => addToast("Link copied!", "success")}
 *   onError={() => addToast("Failed to copy link", "error")}
 * />
 */
export function CopyUrlButton({
  url,
  label = "Copy Link",
  className = "",
  onSuccess,
  onError,
}: CopyUrlButtonProps) {
  const [state, setState] = useState<CopyState>("idle");

  const handleCopy = useCallback(async () => {
    if (state !== "idle") return; // prevent double-fire during feedback window

    const target = url ?? (typeof window !== "undefined" ? window.location.href : "");

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(target);
      } else {
        // Fallback for older browsers / insecure contexts
        const textarea = document.createElement("textarea");
        textarea.value = target;
        textarea.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0;";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (!ok) throw new Error("execCommand copy failed");
      }

      setState("copied");
      onSuccess?.();
    } catch {
      setState("error");
      onError?.();
    }

    // Reset back to idle after 2 s
    setTimeout(() => setState("idle"), 2000);
  }, [state, url, onSuccess, onError]);

  const isCopied = state === "copied";
  const isError = state === "error";

  return (
    <div className={`inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={handleCopy}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCopy();
          }
        }}
        aria-label={
          isCopied
            ? "Link copied to clipboard"
            : isError
            ? "Failed to copy link"
            : "Copy analysis link to clipboard"
        }
        aria-pressed={isCopied}
        title={isCopied ? "Copied!" : isError ? "Failed to copy" : "Copy link"}
        disabled={state !== "idle"}
        className={[
          // Base layout
          "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium",
          "border transition-all duration-200 select-none",
          "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900",
          // State-specific styles
          isCopied
            ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-400 focus:ring-emerald-500 cursor-default"
            : isError
            ? "bg-red-500/15 border-red-500/50 text-red-400 focus:ring-red-500 cursor-default"
            : [
                "bg-slate-800/60 border-slate-700 text-slate-300",
                "hover:bg-slate-700/80 hover:border-slate-500 hover:text-white",
                "active:scale-95",
                "focus:ring-blue-500",
              ].join(" "),
        ].join(" ")}
      >
        {/* Icon */}
        <span aria-hidden="true" className="flex-shrink-0">
          {isCopied ? (
            // Checkmark
            <svg
              viewBox="0 0 16 16"
              fill="none"
              width="15"
              height="15"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 8.5L6.5 12L13 5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : isError ? (
            // X mark
            <svg
              viewBox="0 0 16 16"
              fill="none"
              width="15"
              height="15"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 4L12 12M12 4L4 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            // Link / copy icon
            <svg
              viewBox="0 0 16 16"
              fill="none"
              width="15"
              height="15"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M6.5 9.5a3.5 3.5 0 0 0 5 0l2-2a3.5 3.5 0 0 0-5-5l-1 1"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M9.5 6.5a3.5 3.5 0 0 0-5 0l-2 2a3.5 3.5 0 0 0 5 5l1-1"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>

        {/* Label */}
        <span>
          {isCopied ? "Copied!" : isError ? "Failed to copy" : label}
        </span>

        {/* Screen-reader live region for state changes */}
        <span aria-live="polite" aria-atomic="true" className="sr-only">
          {isCopied
            ? "Link copied to clipboard."
            : isError
            ? "Could not copy link. Please copy the URL manually."
            : ""}
        </span>
      </button>
    </div>
  );
}
