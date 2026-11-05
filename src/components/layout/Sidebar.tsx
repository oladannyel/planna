"use client";

import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

import { useSidebar } from "./SidebarProvider";
import { NAV_GROUPS, NAV_ITEMS } from "./nav-items";

function NavLinks({ onNavigate }: { onNavigate?: () => void }): JSX.Element {
  const pathname = usePathname();
  const { showLabels } = useSidebar();

  return (
    <nav className="flex flex-col gap-5">
      {NAV_GROUPS.map((group) => {
        const items = NAV_ITEMS.filter((item) => item.group === group.key);
        if (items.length === 0) return null;

        return (
          <div key={group.key}>
            <p
              className={cn(
                "mb-2 px-3 text-xs font-medium uppercase tracking-wider text-text-muted transition-opacity",
                showLabels ? "opacity-100" : "opacity-0",
              )}
              aria-hidden={!showLabels}
            >
              {group.label}
            </p>
            <ul className="flex flex-col gap-1">
              {items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;

                // Spread optional props rather than pass `undefined`:
                // exactOptionalPropertyTypes rejects an explicit undefined.
                const optional = {
                  ...(onNavigate ? { onClick: onNavigate } : {}),
                  ...(isActive ? { "aria-current": "page" as const } : {}),
                  ...(showLabels ? {} : { title: item.label }),
                };

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      {...optional}
                      className={cn(
                        "menu-item group",
                        isActive ? "menu-item-active" : "menu-item-inactive",
                        showLabels ? "justify-start" : "justify-center",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0",
                          isActive ? "menu-item-icon-active" : "menu-item-icon-inactive",
                        )}
                        aria-hidden
                      />
                      {showLabels ? (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.upcoming ? (
                            <span className="menu-badge bg-text-muted/15 text-text-muted">
                              soon
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="sr-only">{item.label}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function SidebarBrand({ workspaceName }: { workspaceName: string }): JSX.Element {
  const { showLabels } = useSidebar();

  return (
    <div className={cn("flex items-center gap-3 px-3 py-1", showLabels ? "" : "justify-center")}>
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-purple font-display text-base font-bold text-white"
        aria-hidden
      >
        p
      </span>
      {showLabels ? (
        <div className="min-w-0">
          <p className="font-display text-base font-bold leading-tight">plAnna</p>
          <p className="truncate text-xs text-text-secondary">{workspaceName}</p>
        </div>
      ) : null}
    </div>
  );
}

export function Sidebar({ workspaceName }: { workspaceName: string }) {
  const { collapsed, mobileOpen, setMobileOpen, setHovered, toggleCollapsed } = useSidebar();

  return (
    <>
      {/* Desktop rail */}
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          "hidden shrink-0 flex-col gap-6 border-e border-border bg-card px-4 py-5 transition-[width] duration-200 md:flex",
          collapsed ? "w-[88px]" : "w-[260px]",
        )}
      >
        <SidebarBrand workspaceName={workspaceName} />
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          <NavLinks />
        </div>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="menu-item menu-item-inactive justify-center"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden />
          ) : (
            <PanelLeftClose className="h-[18px] w-[18px]" aria-hidden />
          )}
        </button>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-999 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 start-0 flex w-[280px] flex-col gap-6 border-e border-border bg-card px-4 py-5"
          >
            <div className="flex items-center justify-between">
              <SidebarBrand workspaceName={workspaceName} />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="menu-item menu-item-inactive w-auto"
              >
                <X className="h-[18px] w-[18px]" aria-hidden />
              </button>
            </div>
            <div className="scrollbar-thin flex-1 overflow-y-auto">
              <NavLinks onNavigate={() => setMobileOpen(false)} />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
