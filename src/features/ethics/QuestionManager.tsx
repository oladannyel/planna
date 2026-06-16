"use client";

import { X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";

import { addQuestion, deactivateQuestion } from "./actions";
import type { EthicsQuestion } from "./types";

export function QuestionManager({ questions }: { questions: EthicsQuestion[] }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const trimmed = text.trim();

  async function add(): Promise<void> {
    if (trimmed.length === 0) return;
    setBusy(true);
    const result = await addQuestion(trimmed);
    setBusy(false);
    if (result.ok) setText("");
  }

  async function remove(id: string): Promise<void> {
    setBusy(true);
    await deactivateQuestion(id);
    setBusy(false);
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-medium">Your questions</h2>
      <ul className="space-y-2">
        {questions.map((q) => (
          <li key={q.id} className="flex items-center justify-between gap-3 text-sm">
            <span>{q.question}</span>
            <button
              type="button"
              onClick={() => void remove(q.id)}
              disabled={busy}
              aria-label={`Remove: ${q.question}`}
              className="shrink-0 text-text-muted hover:text-danger"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </li>
        ))}
        {questions.length === 0 ? (
          <li className="text-sm text-text-muted">No questions yet.</li>
        ) : null}
      </ul>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
        className="flex gap-2"
      >
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Add a reflection question"
          aria-label="New reflection question"
          className="w-full rounded-xl border border-border bg-canvas px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-purple"
        />
        <Button type="submit" disabled={busy || trimmed.length === 0}>
          Add
        </Button>
      </form>
    </div>
  );
}
