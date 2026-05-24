"use client";

import React from "react";
import { Modal } from "@/components/ui/Modal";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ShortcutRow = ({
  action,
  shortcut,
}: {
  action: string;
  shortcut: string;
}) => (
  <div className="flex items-center justify-between py-3 border-b border-border">
    <span className="font-medium text-foreground">
      {action}
    </span>

    <kbd className="px-3 py-1 rounded-lg bg-muted border text-sm font-semibold">
      {shortcut}
    </kbd>
  </div>
);

export default function KeyboardShortcutsModal({
  isOpen,
  onClose,
}: KeyboardShortcutsModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Keyboard Shortcuts"
    >
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground mb-4">
          Navigate GitVerse faster using keyboard shortcuts
        </p>

        <ShortcutRow
          action="Open shortcuts help"
          shortcut="Shift + /"
        />

        <ShortcutRow
          action="Close modal"
          shortcut="Esc"
        />

        <ShortcutRow
          action="Quick Search"
          shortcut="/"
        />

        <ShortcutRow
          action="Command Search"
          shortcut="Ctrl + K"
        />

        <ShortcutRow
          action="Go to Home"
          shortcut="g + h"
        />

        <ShortcutRow
          action="Go to Dashboard"
          shortcut="g + d"
        />

        <ShortcutRow
          action="Go to Search"
          shortcut="g + s"
        />
      </div>
    </Modal>
  );
}