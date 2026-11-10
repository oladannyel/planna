import { headers } from "next/headers";

import { env } from "@/lib/env";

/** Trailing slashes make `${origin}/request/x` into `//request/x`. */
function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/**
 * The origin a shareable link should be built from.
 *
 * Read from the request rather than from `NEXT_PUBLIC_APP_URL`, because this
 * link's whole job is to be handed to someone else — a link that points at the
 * wrong host is worse than no link at all, and it fails silently: it looks
 * right, it just never reaches the board. The request headers always describe
 * the host the owner is actually looking at, whether that is localhost, a
 * preview deployment or production. The configured URL is the fallback for
 * the case where there are no headers to read.
 */
export async function publicOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) return trimTrailingSlash(env.NEXT_PUBLIC_APP_URL);

  const forwardedProto = headerList.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  const protocol = forwardedProto ?? (isLocal ? "http" : "https");

  return `${protocol}://${host}`;
}

/** The public URL a colleague uses to file a task into this workspace. */
export function requestLinkFor(origin: string, slug: string): string {
  return `${trimTrailingSlash(origin)}/request/${slug}`;
}
