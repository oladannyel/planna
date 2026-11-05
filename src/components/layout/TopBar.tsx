"use client";

import { LogOut, Menu, Search } from "lucide-react";

import { ThemeToggler } from "@/components/theme";

import { useSidebar } from "./SidebarProvider";

export function TopBar({ email }: { email: string }) {
  const { setMobileOpen } = useSidebar();

  return (
    <header className="sticky top-0 z-99 flex items-center gap-3 border-b border-border bg-card/80 px-4 py-3 backdrop-blur md:px-6">
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
        className="menu-item menu-item-inactive w-auto md:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      {/* Presentational for now: the command palette lands with P5. */}
      <div className="relative hidden min-w-0 flex-1 md:block md:max-w-sm">
        <Search
          className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          aria-hidden
        />
        <input
          type="search"
          placeholder="Search tasks…"
          aria-label="Search tasks"
          className="w-full rounded-lg border border-border bg-canvas py-2 pe-3 ps-9 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-purple focus:ring-4 focus:ring-purple/10"
        />
      </div>

      <div className="ms-auto flex items-center gap-2">
        <span className="hidden truncate text-sm text-text-secondary sm:inline">{email}</span>
        <ThemeToggler />
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            aria-label="Sign out"
            title="Sign out"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:bg-card-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple"
          >
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </form>
      </div>
    </header>
  );
}
