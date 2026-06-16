"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import type { AppError } from "@/lib/result";

import { createTask, createTaskFromText } from "./actions";

type Feedback =
  | { kind: "idle" }
  | { kind: "success"; title: string; confidence: number }
  | { kind: "error"; message: string };

function errorMessage(error: AppError): string {
  switch (error.code) {
    case "UNAUTHORIZED":
      return "Please sign in to add tasks.";
    case "AI_ERROR":
      return "Couldn't parse that automatically — try adding it manually.";
    case "VALIDATION_ERROR":
      return "That doesn't look like a valid task.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function QuickAdd() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>({ kind: "idle" });

  const trimmed = text.trim();
  const canSubmit = trimmed.length > 0 && !busy;

  async function addWithAi(): Promise<void> {
    if (!canSubmit) return;
    setBusy(true);
    setFeedback({ kind: "idle" });
    const result = await createTaskFromText(trimmed);
    setBusy(false);
    if (result.ok) {
      setText("");
      setFeedback({
        kind: "success",
        title: result.value.parsed.title,
        confidence: result.value.confidence,
      });
    } else {
      setFeedback({ kind: "error", message: errorMessage(result.error) });
    }
  }

  async function addManually(): Promise<void> {
    if (!canSubmit) return;
    setBusy(true);
    const result = await createTask({ title: trimmed, priority: "medium", tags: [] });
    setBusy(false);
    if (result.ok) {
      setText("");
      setFeedback({ kind: "success", title: result.value.title, confidence: 1 });
    } else {
      setFeedback({ kind: "error", message: errorMessage(result.error) });
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <Textarea
        aria-label="New task"
        rows={2}
        value={text}
        placeholder="Add a task in plain English — e.g. “Email the client the proposal by Friday”"
        onChange={(event) => setText(event.target.value)}
        disabled={busy}
      />
      <div className="mt-3 flex items-center gap-2">
        <Button onClick={() => void addWithAi()} disabled={!canSubmit}>
          {busy ? "Adding…" : "Add with AI"}
        </Button>
        <Button variant="ghost" onClick={() => void addManually()} disabled={!canSubmit}>
          Add manually
        </Button>
      </div>

      {feedback.kind === "success" ? (
        <p className="mt-3 text-sm text-teal">
          Added “{feedback.title}” · {Math.round(feedback.confidence * 100)}% confidence
        </p>
      ) : null}
      {feedback.kind === "error" ? (
        <p className="mt-3 text-sm text-danger">{feedback.message}</p>
      ) : null}
    </div>
  );
}
