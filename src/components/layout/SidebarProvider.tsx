"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "planna-sidebar-collapsed";

interface SidebarContextValue {
  /** Collapsed to an icon rail (desktop only). */
  collapsed: boolean;
  /** Temporarily expanded because the pointer is over the rail. */
  hovered: boolean;
  /** Mobile drawer open state. */
  mobileOpen: boolean;
  /** Whether labels should render right now. */
  showLabels: boolean;
  toggleCollapsed: () => void;
  setHovered: (next: boolean) => void;
  setMobileOpen: (next: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "true");
    } catch {
      // Storage unavailable — the default expanded state is fine.
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Not persisted; the session still works.
      }
      return next;
    });
  }, []);

  // Collapsed rails still show labels while hovered, which is what makes an
  // icon rail usable without committing to expanding it.
  const showLabels = !collapsed || hovered;

  const value = useMemo(
    () => ({
      collapsed,
      hovered,
      mobileOpen,
      showLabels,
      toggleCollapsed,
      setHovered,
      setMobileOpen,
    }),
    [collapsed, hovered, mobileOpen, showLabels, toggleCollapsed],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext);
  if (!context) throw new Error("useSidebar must be used within a SidebarProvider");
  return context;
}
