import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Page title with breadcrumbs and an optional action slot — the shape every
 * dashboard route repeats.
 */
export function PageHeader({
  title,
  crumbs = [],
  action,
  className,
}: {
  title: string;
  crumbs?: Crumb[];
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="font-display text-title-md font-bold text-text-primary">{title}</h1>
        {crumbs.length > 0 ? (
          <nav aria-label="Breadcrumb" className="mt-1">
            <ol className="flex flex-wrap items-center gap-1.5 text-sm text-text-secondary">
              {crumbs.map((crumb, index) => (
                <li key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
                  {crumb.href ? (
                    <Link href={crumb.href} className="transition-colors hover:text-text-primary">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current="page" className="text-text-primary">
                      {crumb.label}
                    </span>
                  )}
                  {index < crumbs.length - 1 ? (
                    <span aria-hidden className="text-text-muted">
                      /
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
