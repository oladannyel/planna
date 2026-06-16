import { cn } from "@/lib/cn";

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "h-5 w-5 animate-spin rounded-full border-2 border-text-muted border-t-transparent",
        className,
      )}
    />
  );
}
