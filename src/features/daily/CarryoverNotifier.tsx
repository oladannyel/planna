"use client";

import { useEffect, useRef } from "react";

import { useToast } from "@/components/ui/Toast";

const SESSION_KEY = "planna:carryover-notified";

/**
 * Fires a one-time toast on dashboard load when carryovers exist. Guarded by
 * `sessionStorage` so it shows at most once per browser session, and by a ref
 * so it never double-fires within a render lifecycle.
 */
export function CarryoverNotifier({ count }: { count: number }) {
  const { toast } = useToast();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current || count <= 0) return;
    if (sessionStorage.getItem(SESSION_KEY) !== null) return;

    sessionStorage.setItem(SESSION_KEY, "1");
    fired.current = true;
    toast({
      title: "Carryovers",
      description: `${count} task${count === 1 ? "" : "s"} carried over from previous days.`,
      tone: "warning",
    });
  }, [count, toast]);

  return null;
}
