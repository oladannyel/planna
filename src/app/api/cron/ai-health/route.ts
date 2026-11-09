import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { runHealthCheck } from "@/features/ai-health";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { pruneRequestThrottle } from "@/lib/throttle-maintenance";

/**
 * Constant-time bearer comparison. `!==` on a secret returns as soon as it
 * finds a differing byte, which leaks the length of the matching prefix to
 * anyone able to time the responses. The cost of getting this right is one
 * import.
 */
function bearerMatches(header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  const received = Buffer.from(header, "utf8");
  // timingSafeEqual throws on a length mismatch, which is itself a leak of
  // one bit — unavoidable, and far less than a prefix.
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

/** Always hit OpenRouter — a cached health check is worse than none. */
export const dynamic = "force-dynamic";

/**
 * Daily OpenRouter health check, run by Vercel Cron (see vercel.json).
 *
 * Free models churn and keys get revoked, and both failures surface to the
 * user as a task that will not parse. This finds out first.
 *
 * Returns 503 when something needs a human, so a failing run is visible in
 * Vercel's cron history instead of only in the logs.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const secret = env.CRON_SECRET;

  // Fail closed. Without a secret this route would let anyone on the internet
  // spend the API quota, so it refuses to run rather than stand open.
  if (!secret) {
    logger.error("AI health check not configured", { reason: "CRON_SECRET is not set" });
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }

  if (!bearerMatches(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Housekeeping on the one schedule that already exists. Closed throttle
  // windows are dead rows; nothing reads them and nothing else deletes them.
  // Failure here is logged, never fatal — the health check is the job.
  const pruned = await pruneRequestThrottle();
  if (!pruned.ok) {
    logger.warn("Throttle prune failed", { error: pruned.error.message });
  }

  const report = await runHealthCheck();

  if (report.healthy) {
    logger.info("AI health check passed", {
      models: report.models.map((m) => `${m.model} -> ${m.servedBy ?? m.model}`),
    });
    return NextResponse.json(report, { status: 200 });
  }

  logger.error("AI health check failed", {
    key: report.key,
    failing: report.models.filter((m) => m.verdict !== "ok"),
  });
  return NextResponse.json(report, { status: 503 });
}
