"use client";

import React, { useState } from "react";
import useKeyboardShortcuts from "@/hooks/useKeyboardShortcuts";
import KeyboardShortcutsModal from "@/components/ui/KeyboardShortcutsModal";

export default function KeyboardAccessibilityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showModal, setShowModal] = useState(false);

  console.log("Keyboard provider mounted");

  useKeyboardShortcuts({
    onOpenHelp: () => {
      console.log("OPEN MODAL");
      setShowModal(true);
    },
    onCloseHelp: () => {
      console.log("CLOSE MODAL");
      setShowModal(false);
    },
  });

  return (
    <>
      {children}

      <KeyboardShortcutsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}