import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

import { FIELD_BASE } from "./Input";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(FIELD_BASE, "resize-none", className)} {...props} />;
}
