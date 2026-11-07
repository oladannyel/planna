import * as React from "react";

/**
 * Memoize an async server function for the duration of one request.
 *
 * Next.js renders the dashboard layout and the page beneath it in the same
 * pass, so a query needed by both ran twice per navigation. React's `cache`
 * deduplicates that.
 *
 * `cache` only exists under React's `react-server` condition — the Server
 * Components build. In the client build, and in Vitest's jsdom environment,
 * the export is simply absent, so this falls back to calling through. That
 * means the *behaviour* is identical either way and only the deduplication is
 * lost, which is what makes the fallback safe rather than a silent lie: an
 * uncached call returns the same result, just at a cost.
 *
 * Consequence worth knowing: the unit tests exercise the uncached path. They
 * verify what these functions return, not that they are deduplicated. The
 * deduplication is a production-only property.
 */
type AsyncFn<A extends unknown[], R> = (...args: A) => Promise<R>;

const reactCache = (React as unknown as { cache?: <T>(fn: T) => T }).cache;

export function requestMemo<A extends unknown[], R>(fn: AsyncFn<A, R>): AsyncFn<A, R> {
  return typeof reactCache === "function" ? reactCache(fn) : fn;
}
