import { HTMLAttributes } from "react";

interface ChecklistItemProps extends Omit<HTMLAttributes<HTMLLabelElement>, "onToggle"> {
  id: string;
  label: string;
  checked: boolean;
  onToggle: (id: string) => void;
}

export function ChecklistItem({
  id,
  label,
  checked,
  onToggle,
  className = "",
  ...props
}: ChecklistItemProps) {
  return (
    <label
      htmlFor={id}
      className={`group flex items-center gap-3 rounded-2xl border border-border/70 bg-background/80 px-4 py-3 transition-all duration-200 hover:border-primary/70 focus-within:ring-2 focus-within:ring-primary/20 ${className}`}
      {...props}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(id)}
        className="h-4 w-4 rounded border-muted-foreground text-primary focus:ring-primary"
      />
      <span className={`text-sm ${checked ? "text-foreground" : "text-muted-foreground"}`}>
        {label}
      </span>
    </label>
  );
}
