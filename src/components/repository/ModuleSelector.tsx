"use client";

import { getAvailableModules } from "@/config/moduleMetadata";

interface ModuleSelectorProps {
  value: string | null;
  onChange: (moduleName: string) => void;
  placeholder?: string;
  excludeModule?: string;
  className?: string;
  label?: string;
}

export function ModuleSelector({
  value,
  onChange,
  placeholder = "Select a module...",
  excludeModule,
  className = "",
  label,
}: ModuleSelectorProps) {
  const modules = getAvailableModules().filter(
    (mod) => mod !== excludeModule
  );

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="text-sm font-semibold text-foreground">
          {label}
        </label>
      )}
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 hover:border-border/80"
        aria-label={label || placeholder}
      >
        <option value="">{placeholder}</option>
        {modules.map((module) => (
          <option key={module} value={module}>
            {module.charAt(0).toUpperCase() + module.slice(1)} /
          </option>
        ))}
      </select>
    </div>
  );
}
