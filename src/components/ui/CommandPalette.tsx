"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Command } from "cmdk";
import {
  LayoutDashboard,
  Search,
  Settings,
  Moon,
  Plus,
  GitBranch,
} from "lucide-react";

interface CommandPaletteProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export function CommandPalette({ open, setOpen }: CommandPaletteProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  // Toggle the menu when ⌘K is pressed
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, setOpen]);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        [cmdk-overlay] {
          position: fixed;
          inset: 0;
          z-index: 50;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(4px);
          animation: fade-in 0.2s ease-out;
        }
        [cmdk-dialog] {
          position: fixed;
          top: 20%;
          left: 50%;
          transform: translateX(-50%);
          z-index: 51;
          width: 90%;
          max-width: 32rem;
          outline: none;
          animation: slide-in 0.2s ease-out;
        }
        [cmdk-group-heading] {
          padding-left: 0.5rem;
          padding-right: 0.5rem;
          padding-top: 0.375rem;
          padding-bottom: 0.375rem;
          font-size: 0.75rem;
          font-weight: 500;
          color: hsl(var(--muted-foreground));
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-in {
          from { opacity: 0; transform: translate(-50%, -10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}} />
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Global Command Menu"
      >
        <div className="w-full overflow-hidden rounded-xl border border-border/50 bg-card/90 backdrop-blur-xl shadow-2xl text-foreground">
          <Command.Input
            placeholder="Type a command or search..."
            className="w-full border-none bg-transparent px-4 py-4 text-sm outline-none placeholder:text-muted-foreground focus:ring-0"
          />
          <Command.List className="max-h-[300px] overflow-y-auto p-2 border-t border-border/50">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            <Command.Group heading="Navigation">
              <Command.Item
                onSelect={() => runCommand(() => router.push("/dashboard"))}
                className="flex items-center gap-2 px-2 py-2 text-sm rounded-md aria-selected:bg-accent aria-selected:text-accent-foreground cursor-pointer text-foreground"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Go to Dashboard</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push("/search"))}
                className="flex items-center gap-2 px-2 py-2 text-sm rounded-md aria-selected:bg-accent aria-selected:text-accent-foreground cursor-pointer text-foreground"
              >
                <Search className="h-4 w-4" />
                <span>Search Repositories</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push("/settings"))}
                className="flex items-center gap-2 px-2 py-2 text-sm rounded-md aria-selected:bg-accent aria-selected:text-accent-foreground cursor-pointer text-foreground"
              >
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Command.Item>
            </Command.Group>

            <Command.Separator className="my-1 h-px bg-border/50" />

            <Command.Group heading="Quick Actions">
              <Command.Item
                onSelect={() => runCommand(() => {
                  setTheme(theme === "dark" ? "light" : "dark");
                })}
                className="flex items-center gap-2 px-2 py-2 text-sm rounded-md aria-selected:bg-accent aria-selected:text-accent-foreground cursor-pointer text-foreground"
              >
                <Moon className="h-4 w-4" />
                <span>Toggle Dark Mode</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push("/contribute"))}
                className="flex items-center gap-2 px-2 py-2 text-sm rounded-md aria-selected:bg-accent aria-selected:text-accent-foreground cursor-pointer text-foreground"
              >
                <Plus className="h-4 w-4" />
                <span>Contribute / New Issue</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </div>
      </Command.Dialog>
    </>
  );
}
