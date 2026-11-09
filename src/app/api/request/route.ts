import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ingestRequest } from "@/features/request/ingest";
import { clientAddress } from "@/features/request/throttle";
import { requestInputSchema } from "@/features/tasks/schema";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validated = requestInputSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json(
      { error: "Invalid request", details: validated.error.flatten() },
      { status: 400 },
    );
  }

  const result = await ingestRequest(validated.data, {
    address: clientAddress(req.headers),
  });
  if (result.ok) {
    return NextResponse.json({ success: true }, { status: 201 });
  }

  if (result.error.code === "NOT_FOUND") {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  if (result.error.code === "RATE_LIMIT") {
    // 429 with Retry-After, so well-behaved clients back off instead of
    // hammering an endpoint that is already refusing them.
    return NextResponse.json(
      { error: result.error.message },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  logger.error("Request ingestion failed", { error: result.error });
  return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
}
