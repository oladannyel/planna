"use client";

import { Scale } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

import { saveReflection } from "./actions";
import type { EthicsQuestion, ReflectionAnswer } from "./types";

interface EthicsCheckinProps {
  weekStart: string;
  questions: EthicsQuestion[];
  initialAnswers: ReflectionAnswer[];
}

export function EthicsCheckin({ weekStart, questions, initialAnswers }: EthicsCheckinProps) {
  const initial = new Map(initialAnswers.map((a) => [a.questionId, a.answer]));
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, initial.get(q.id) ?? ""])),
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(): Promise<void> {
    setBusy(true);
    setError(null);
    setSaved(false);
    const payload: ReflectionAnswer[] = questions.map((q) => ({
      questionId: q.id,
      question: q.question,
      answer: answers[q.id] ?? "",
    }));
    const result = await saveReflection(weekStart, payload);
    setBusy(false);
    if (result.ok) {
      setSaved(true);
    } else {
      setError("Couldn't save your reflection. Please try again.");
    }
  }

  if (questions.length === 0) {
    return (
      <EmptyState
        icon={Scale}
        title="No reflection questions yet"
        message="Add a question below to start your weekly check-in."
      />
    );
  }

  return (
    <div className="surface space-y-4 p-4">
      <h2 className="text-sm font-medium">This week&apos;s check-in</h2>
      {questions.map((q) => (
        <div key={q.id} className="space-y-1">
          <label htmlFor={`q-${q.id}`} className="block text-sm text-text-secondary">
            {q.question}
          </label>
          <Textarea
            id={`q-${q.id}`}
            rows={2}
            value={answers[q.id] ?? ""}
            onChange={(event) => setAnswers((prev) => ({ ...prev, [q.id]: event.target.value }))}
          />
        </div>
      ))}
      <div className="flex items-center gap-3">
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? "Saving…" : "Save reflection"}
        </Button>
        {saved ? <span className="text-sm text-teal">Saved.</span> : null}
        {error !== null ? <span className="text-sm text-danger-ink">{error}</span> : null}
      </div>
    </div>
  );
}
