import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { runHealthCheck } from "@/features/ai-health";
import { logger } from "@/lib/logger";

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
  const secret = process.env.CRON_SECRET;

  // Fail closed. Without a secret this route would let anyone on the internet
  // spend the API quota, so it refuses to run rather than stand open.
  if (!secret) {
    logger.error("AI health check not configured", { reason: "CRON_SECRET is not set" });
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
