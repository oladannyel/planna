"use client";

import * as RToast from "@radix-ui/react-toast";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type Tone = "default" | "warning" | "success" | "error";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: Tone;
}

export interface ToastInput {
  title: string;
  description?: string;
  tone?: Tone;
}

interface ToastApi {
  toast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within <ToastProvider>");
  }
  return ctx;
}

const TONE_CLASS: Record<Tone, string> = {
  default: "border-border",
  warning: "border-amber/50",
  success: "border-teal/50",
  error: "border-danger/50",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const toast = useCallback((input: ToastInput) => {
    nextId.current += 1;
    const item: ToastItem = { id: nextId.current, tone: "default", ...input };
    setItems((prev) => [...prev, item]);
  }, []);

  const api = useMemo<ToastApi>(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      <RToast.Provider swipeDirection="right" duration={5000}>
        {children}
        {items.map((item) => (
          <RToast.Root
            key={item.id}
            onOpenChange={(open) => {
              if (!open) setItems((prev) => prev.filter((i) => i.id !== item.id));
            }}
            className={cn(
              "rounded-xl border bg-card p-3 text-text-primary shadow-lg",
              TONE_CLASS[item.tone],
            )}
          >
            <RToast.Title className="text-sm font-medium">{item.title}</RToast.Title>
            {item.description !== undefined ? (
              <RToast.Description className="text-xs text-text-secondary">
                {item.description}
              </RToast.Description>
            ) : null}
          </RToast.Root>
        ))}
        <RToast.Viewport className="fixed bottom-20 right-0 z-50 m-4 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 outline-none md:bottom-0" />
      </RToast.Provider>
    </ToastContext.Provider>
  );
}
