"use client";

import { Bell, Inbox } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

import { markNotificationsRead } from "./actions";
import type { BellNotification } from "./queries";

function formatWhen(iso: string): string {
  const then = new Date(iso).getTime();
  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * The bell in the top bar.
 *
 * Rendered from data the layout already fetched, so opening it costs nothing
 * and the badge is correct on first paint rather than popping in after a
 * client fetch. Opening marks everything read — the count answers "is there
 * something I have not seen", and once the list is on screen the answer is no.
 */
export function NotificationBell({ items, unread }: { items: BellNotification[]; unread: number }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(unread);
  const [lastUnread, setLastUnread] = useState(unread);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  // The server is the source of truth for the badge, and the local copy only
  // exists so the count can drop the instant the menu opens rather than after
  // the round trip. Adjusted during render when the prop changes — React's
  // documented alternative to an effect that only calls setState, which
  // renders twice and flashes the stale number.
  if (lastUnread !== unread) {
    setLastUnread(unread);
    setCount(unread);
  }

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent): void {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function toggle(): Promise<void> {
    const next = !open;
    setOpen(next);
    if (next && count > 0) {
      setCount(0);
      await markNotificationsRead();
      router.refresh();
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => void toggle()}
        aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="menu"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:bg-card-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple"
      >
        <Bell className="h-4 w-4" aria-hidden />
        {count > 0 ? (
          <span
            aria-hidden
            className="absolute -end-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white"
          >
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Notifications"
          className="surface absolute end-0 top-11 z-99 w-80 overflow-hidden p-0"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-medium text-text-primary">Notifications</p>
            <Link
              href="/requests"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-purple-ink hover:underline"
            >
              Open inbox
            </Link>
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Inbox className="mx-auto h-6 w-6 text-text-muted" aria-hidden />
              <p className="mt-2 text-sm text-text-secondary">Nothing yet.</p>
            </div>
          ) : (
            <ul className="scrollbar-thin max-h-80 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href="/requests"
                    onClick={() => setOpen(false)}
                    className={cn(
                      "block border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-card-hover",
                      item.readAt ? "" : "bg-purple/5",
                    )}
                  >
                    <p className="text-sm font-medium text-text-primary">{item.title}</p>
                    {item.body ? (
                      <p className="mt-0.5 truncate text-sm text-text-secondary">{item.body}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-text-muted">{formatWhen(item.createdAt)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
