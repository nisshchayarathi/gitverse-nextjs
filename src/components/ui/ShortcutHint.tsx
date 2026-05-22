interface ShortcutHintProps {
  className?: string;
}

export function ShortcutHint({
  className = "",
}: ShortcutHintProps) {
  return (
    <p
      className={`text-xs text-muted-foreground mt-2 ${className}`}
      aria-label="Keyboard shortcuts help"
    >
      Press &quot;/&quot; to focus search • Esc to clear
    </p>
  );
}