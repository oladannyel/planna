"use client";

import { FileText } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/Button";

import { generateWeeklyReport } from "./actions";

interface WeeklyReportProps {
  weekStart: string;
  hasTasks: boolean;
  initialNarrative: string | null;
}

export function WeeklyReport({ weekStart, hasTasks, initialNarrative }: WeeklyReportProps) {
  const [narrative, setNarrative] = useState<string | null>(initialNarrative);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate(): Promise<void> {
    setBusy(true);
    setError(null);
    const result = await generateWeeklyReport(weekStart);
    setBusy(false);
    if (result.ok) {
      setNarrative(result.value.narrative);
    } else {
      setError("Couldn't generate the report. Please try again.");
    }
  }

  if (!hasTasks) {
    return (
      <EmptyState
        icon={FileText}
        title="No activity this week"
        message="Once you create or complete tasks this week, you can generate a report."
      />
    );
  }

  return (
    <div className="surface space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Weekly report</h3>
        <Button onClick={() => void generate()} disabled={busy}>
          {busy ? "Generating…" : narrative !== null ? "Regenerate" : "Generate report"}
        </Button>
      </div>

      {busy ? (
        <div className="space-y-2" aria-busy="true">
          <div className="h-3 w-full animate-pulse rounded bg-canvas" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-canvas" />
        </div>
      ) : narrative !== null ? (
        <p className="whitespace-pre-line text-sm text-text-secondary">{narrative}</p>
      ) : (
        <p className="text-sm text-text-muted">No report generated yet.</p>
      )}

      {error !== null ? <p className="text-sm text-danger-ink">{error}</p> : null}
    </div>
  );
}
