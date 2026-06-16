import { Flame } from "lucide-react";

export function StreakCounter({ streak }: { streak: number }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
      <Flame
        className={streak > 0 ? "h-4 w-4 text-amber" : "h-4 w-4 text-text-muted"}
        aria-hidden
      />
      <span className="text-sm font-medium">
        {streak} day{streak === 1 ? "" : "s"} streak
      </span>
    </div>
  );
}
