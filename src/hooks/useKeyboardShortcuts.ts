"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface KeyboardShortcutHandlers {
  onOpenHelp: () => void;
  onCloseHelp: () => void;
}

export default function useKeyboardShortcuts({
  onOpenHelp,
  onCloseHelp,
}: KeyboardShortcutHandlers) {
  const router = useRouter();
  const keyBuffer = useRef<string[]>([]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      console.log("KEY:", e.key, "CTRL:", e.ctrlKey);

      const active = document.activeElement as HTMLElement | null;

      const isTyping =
        active &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName);

      if (isTyping) return;

      // OPEN HELP MODAL
      if (e.key === "?") {
        e.preventDefault();
        onOpenHelp();
        return;
      }

      // CLOSE
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseHelp();
        keyBuffer.current = [];
        return;
      }

      // SEARCH
      if (
        e.key === "/" ||
        (e.ctrlKey && e.key.toLowerCase() === "k")
      ) {
        e.preventDefault();
        router.push("/search");
        return;
      }

      // NAVIGATION COMBOS
      keyBuffer.current.push(e.key.toLowerCase());

      if (keyBuffer.current.length > 2) {
        keyBuffer.current.shift();
      }

      const combo = keyBuffer.current.join("");

      if (combo === "gh") {
        router.push("/");
        keyBuffer.current = [];
      }

      if (combo === "gd") {
        router.push("/dashboard");
        keyBuffer.current = [];
      }

      if (combo === "gs") {
        router.push("/search");
        keyBuffer.current = [];
      }
    };

    window.addEventListener("keydown", handler);

    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [router, onOpenHelp, onCloseHelp]);
}