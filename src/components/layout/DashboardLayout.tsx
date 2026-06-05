"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  GitBranch,
  LayoutDashboard,
  Search,
  Settings,
  GitPullRequest,
  LogOut,
  User,
  ChevronLeft,
  Menu,
  FileDiff,
  GitCompare,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button, ThemeToggle } from "@/components/ui";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { toast } from "@/hooks/use-toast";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
}) => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast({
      title: "Logged out",
      description: "You have been successfully logged out",
    });
    router.push("/login");
  };

  const navItems = [
    { icon: LayoutDashboard, label: "Visualise", path: "/dashboard" },
    { icon: FileDiff, label: "Simulate PR", path: "/simulate-pr" },
    { icon: GitCompare, label: "Compare", path: "/compare" },
    { icon: Search, label: "Search", path: "/search" },
    { icon: GitPullRequest, label: "Contribute", path: "/contribute" },
    { icon: Settings, label: "Settings", path: "/settings" },
  ];

  const isActive = (path: string) => pathname === path;

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar - Desktop */}
      <aside
        className={`fixed top-0 left-0 z-40 h-screen transition-all duration-300 hidden md:block ${
          sidebarOpen ? "w-64" : "w-20"
        }`}
      >
        <div className="h-full glass border-r border-border/50 flex flex-col">
          {/* Logo */}
          <div className="p-4 border-b border-border/50">
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="relative">
                <GitBranch className="h-8 w-8 text-primary transition-transform group-hover:scale-110" />
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {sidebarOpen && (
                <span className="text-xl font-heading font-bold text-foreground">
                  Git<span className="text-gradient">Verse</span>
                </span>
              )}
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                  isActive(item.path)
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            ))}
          </nav>

          {/* Toggle Sidebar Button */}
          <div className="p-4 border-t border-border/50">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-accent transition-colors"
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              <ChevronLeft
                className={`h-5 w-5 transition-transform ${!sidebarOpen ? "rotate-180" : ""}`}
              />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="fixed top-0 left-0 z-50 h-screen w-64 md:hidden">
            <div className="h-full glass border-r border-border/50 flex flex-col">
              {/* Logo */}
              <div className="p-4 border-b border-border/50">
                <Link href="/dashboard" className="flex items-center gap-3">
                  <GitBranch className="h-8 w-8 text-primary" />
                  <span className="text-xl font-heading font-bold text-foreground">
                    Git<span className="text-gradient">Verse</span>
                  </span>
                </Link>
              </div>

              {/* Navigation */}
              <nav className="flex-1 p-4 space-y-2">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                      isActive(item.path)
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </nav>
            </div>
          </aside>
        </>
      )}

      {/* Main Content */}
      <div
        className={`transition-all duration-300 ${sidebarOpen ? "md:ml-64" : "md:ml-20"}`}
      >
        {/* Top Bar */}
        <header className="sticky top-0 z-30 glass border-b border-border/50">
          <div className="px-4 py-3 flex items-center justify-between">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-lg hover:bg-accent transition-colors md:hidden"
              aria-label="Open mobile menu"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="flex-1 flex items-center justify-end px-4 sm:px-6 gap-3">
              <Button
                variant="outline"
                className="hidden sm:flex relative h-9 w-full justify-start rounded-[0.5rem] bg-background/50 text-sm text-muted-foreground sm:pr-12 md:w-56 lg:w-64 border-border/50 hover:bg-accent/50"
                onClick={() => setCommandPaletteOpen(true)}
              >
                <span className="hidden lg:inline-flex">Search or jump to...</span>
                <span className="inline-flex lg:hidden">Search...</span>
                <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex text-foreground">
                  <span className="text-xs">⌘</span>K / Ctrl K
                </kbd>
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />

              {/* User Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center">
                    {user?.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="rounded-full"
                        loading="lazy"
                      />
                    ) : (
                      <User className="h-4 w-4 text-primary-foreground" />
                    )}
                  </div>
                  <div className="hidden md:block text-left">
                    <div className="text-sm font-medium">{user?.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {user?.email}
                    </div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 glass">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">{children}</main>
      </div>
      
      {/* Global Command Palette */}
      <CommandPalette open={commandPaletteOpen} setOpen={setCommandPaletteOpen} />
    </div>
  );
};
