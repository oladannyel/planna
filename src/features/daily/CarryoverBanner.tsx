import { AlertTriangle } from "lucide-react";

export function CarryoverBanner({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <div className="flex items-center gap-2 rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber">
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
      <span>
        {count} {count === 1 ? "task has" : "tasks have"} carried over from previous days.
      </span>
    </div>
  );
}
