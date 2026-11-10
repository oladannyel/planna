"use client";

import { Check, Copy, Link2 } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { FIELD_BASE } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

/**
 * The request link, shown so it can be read and copied.
 *
 * A copy button alone would be a dead end wherever the clipboard is
 * unavailable — an insecure origin, a locked-down browser, a denied
 * permission prompt — and the failure is silent: the button says nothing and
 * the paste produces whatever was there before. So the URL is always visible
 * and selectable, and the clipboard is the convenience on top of it rather
 * than the only way out.
 */
export function ShareRequestLink({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const fieldId = useId();
  const fieldRef = useRef<HTMLInputElement>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function selectAll(): void {
    fieldRef.current?.focus();
    fieldRef.current?.select();
  }

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard. Select the text so ⌘C still works — a failure the user
      // can finish by hand beats a button that quietly does nothing.
      selectAll();
    }
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        startIcon={<Link2 className="h-4 w-4" aria-hidden />}
        aria-expanded={open}
        aria-controls={fieldId}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        Share link
      </Button>

      <div
        id={fieldId}
        hidden={!open}
        className={cn(
          "surface absolute end-0 z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] p-4",
          "shadow-theme-lg",
        )}
      >
        <p className="text-sm font-medium text-text-primary">Send me a task</p>
        <p className="mt-1 text-xs text-text-secondary">
          Anyone with this link can add a task to your board. They do not need an account.
        </p>

        <div className="mt-3 flex items-center gap-2">
          <input
            ref={fieldRef}
            readOnly
            aria-label="Your request link"
            value={url}
            onFocus={selectAll}
            className={cn(FIELD_BASE, "px-3 py-2 text-xs")}
          />
          <Button
            variant="primary"
            size="sm"
            className="shrink-0"
            onClick={() => void copy()}
            startIcon={
              copied ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )
            }
          >
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        {/* Announced rather than only coloured, so the confirmation is not
            carried by a change of icon alone. */}
        <p role="status" aria-live="polite" className="sr-only">
          {copied ? "Link copied to clipboard" : ""}
        </p>
      </div>
    </div>
  );
}
