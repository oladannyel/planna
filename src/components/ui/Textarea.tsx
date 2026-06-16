import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full resize-none rounded-xl border border-border bg-canvas px-4 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-purple",
        className,
      )}
      {...props}
    />
  );
}
