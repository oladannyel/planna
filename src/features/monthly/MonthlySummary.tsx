"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/Button";

import { generateMonthlySummary } from "./actions";

interface MonthlySummaryProps {
  year: number;
  month: number;
  hasTasks: boolean;
  initialNarrative: string | null;
}

export function MonthlySummary({ year, month, hasTasks, initialNarrative }: MonthlySummaryProps) {
  const [narrative, setNarrative] = useState<string | null>(initialNarrative);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate(): Promise<void> {
    setBusy(true);
    setError(null);
    const result = await generateMonthlySummary(year, month);
    setBusy(false);
    if (result.ok) {
      setNarrative(result.value.narrative);
    } else {
      setError("Couldn't generate the summary. Please try again.");
    }
  }

  if (!hasTasks) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Nothing to summarize"
        message="There's no activity this month yet — complete some tasks and check back."
      />
    );
  }

  return (
    <div className="surface space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">AI summary</h3>
        <Button onClick={() => void generate()} disabled={busy}>
          {busy ? "Generating…" : narrative !== null ? "Regenerate" : "Generate summary"}
        </Button>
      </div>

      {busy ? (
        <div className="space-y-2" aria-busy="true">
          <div className="h-3 w-full animate-pulse rounded bg-canvas" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-canvas" />
          <div className="h-3 w-4/6 animate-pulse rounded bg-canvas" />
        </div>
      ) : narrative !== null ? (
        <p className="whitespace-pre-line text-sm text-text-secondary">{narrative}</p>
      ) : (
        <p className="text-sm text-text-muted">No summary generated yet.</p>
      )}

      {error !== null ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
