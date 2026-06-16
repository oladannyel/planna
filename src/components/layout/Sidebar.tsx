"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

import { NAV_ITEMS } from "./nav-items";

export function Sidebar({ workspaceName }: { workspaceName: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card p-4 md:flex">
      <div className="px-2 py-3">
        <p className="text-lg font-bold">plAnna</p>
        <p className="truncate text-xs text-text-secondary">{workspaceName}</p>
      </div>

      <nav className="mt-4 flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-purple/15 text-text-primary"
                  : "text-text-secondary hover:bg-white/5",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span className="flex-1">{item.label}</span>
              {item.upcoming ? (
                <span className="rounded bg-border px-1.5 py-0.5 text-[10px] uppercase text-text-muted">
                  soon
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
