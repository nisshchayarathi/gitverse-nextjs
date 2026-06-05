"use client";

import { useEffect } from "react";

export function FocusRingManager() {
  useEffect(() => {
    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        document.body.classList.add("user-is-tabbing");
      }
    };

    const handlePointerDown = () => {
      document.body.classList.remove("user-is-tabbing");
    };

    window.addEventListener("keydown", handleTabKey);
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("touchstart", handlePointerDown);
    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("keydown", handleTabKey);
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  return null;
}
