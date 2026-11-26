import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { pollAllMailboxes } from "@/features/email-intake";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/** Never cached: the job is the side effect, not the response. */
export const dynamic = "force-dynamic";

/** Constant-time bearer comparison — see /api/cron/ai-health for why. */
function bearerMatches(header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  const received = Buffer.from(header, "utf8");
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

/**
 * Hourly Gmail poll (ADR 0002).
 *
 * Fails closed without a `CRON_SECRET`: this route reads people's mailboxes,
 * and an unauthenticated endpoint that does that is worse than a feature that
 * does not run.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const secret = env.CRON_SECRET;

  if (!secret) {
    logger.error("Email intake not configured", { reason: "CRON_SECRET is not set" });
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }

  if (!bearerMatches(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await pollAllMailboxes();

  if (!result.ok) {
    logger.error("Email intake failed", { error: result.error });
    return NextResponse.json({ error: result.error.message }, { status: 503 });
  }

  const created = result.value.reduce((total, summary) => total + summary.created, 0);
  logger.info("Email intake complete", { mailboxes: result.value.length, created });

  return NextResponse.json({ mailboxes: result.value.length, created }, { status: 200 });
}
