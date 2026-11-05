"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import type { AppError } from "@/lib/result";

import { createMultipleTasksFromText, createTask } from "./actions";

type Feedback =
  | { kind: "idle" }
  | { kind: "bulk"; created: number; skipped: number; failed: number }
  | { kind: "success"; title: string }
  | { kind: "error"; message: string };

function errorMessage(error: AppError): string {
  switch (error.code) {
    case "UNAUTHORIZED":
      return "Please sign in to add tasks.";
    case "AI_ERROR":
      return "Couldn't parse that — try adding manually.";
    case "VALIDATION_ERROR":
      return "That doesn't look like a valid task.";
    default:
      return "Something went wrong. Please try again.";
  }
}

const FIELD =
  "w-full rounded-xl border border-border bg-canvas px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-purple";

export function QuickAdd() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>({ kind: "idle" });
  const [showDetails, setShowDetails] = useState(false);
  const [dueLocal, setDueLocal] = useState("");
  const [estimate, setEstimate] = useState("");

  const trimmed = text.trim();
  const canSubmit = trimmed.length > 0 && !busy;

  async function addWithAi(): Promise<void> {
    if (!canSubmit) return;
    setBusy(true);
    setFeedback({ kind: "idle" });
    const result = await createMultipleTasksFromText(trimmed);
    setBusy(false);

    if (!result.ok) {
      setFeedback({ kind: "error", message: errorMessage(result.error) });
      return;
    }

    const { created, skipped, errors } = result.value;
    if (created.length === 0) {
      setFeedback({ kind: "error", message: "No tasks found. Try adding manually." });
      return;
    }

    setText("");
    setFeedback({ kind: "bulk", created: created.length, skipped, failed: errors.length });
  }

  async function addManually(): Promise<void> {
    if (!canSubmit) return;
    setBusy(true);
    const dueAt = dueLocal ? new Date(dueLocal).toISOString() : undefined;
    const estimatedMinutes = estimate.trim() ? Number(estimate) : undefined;
    const result = await createTask({
      title: trimmed,
      priority: "medium",
      tags: [],
      ...(dueAt ? { dueAt } : {}),
      ...(estimatedMinutes && estimatedMinutes > 0 ? { estimatedMinutes } : {}),
    });
    setBusy(false);
    if (result.ok) {
      setText("");
      setDueLocal("");
      setEstimate("");
      setFeedback({ kind: "success", title: result.value.title });
    } else {
      setFeedback({ kind: "error", message: errorMessage(result.error) });
    }
  }

  return (
    <div className="surface p-4">
      <Textarea
        aria-label="New task"
        rows={3}
        value={text}
        placeholder="Paste your day — one line per task. Markers like DONE, IN PROGRESS, SKIP, TBD are detected automatically."
        onChange={(event) => setText(event.target.value)}
        disabled={busy}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button onClick={() => void addWithAi()} disabled={!canSubmit}>
          {busy ? "Adding…" : "Add with AI"}
        </Button>
        <Button variant="ghost" onClick={() => void addManually()} disabled={!canSubmit}>
          Add manually
        </Button>
        <button
          type="button"
          className="ml-auto text-xs text-text-secondary hover:text-text-primary"
          onClick={() => setShowDetails((v) => !v)}
        >
          {showDetails ? "Hide details" : "Add deadline / estimate"}
        </button>
      </div>

      {showDetails ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs text-text-secondary">Deadline (manual add)</span>
            <input
              type="datetime-local"
              aria-label="Deadline"
              className={FIELD}
              value={dueLocal}
              onChange={(event) => setDueLocal(event.target.value)}
              disabled={busy}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-text-secondary">Estimate (min)</span>
            <input
              type="number"
              min={1}
              aria-label="Estimate in minutes"
              className={FIELD}
              value={estimate}
              onChange={(event) => setEstimate(event.target.value)}
              disabled={busy}
            />
          </label>
          <p className="col-span-2 text-xs text-text-muted">
            Left blank, new tasks default to a deadline 24 hours from now — editable anytime by
            clicking the task.
          </p>
        </div>
      ) : null}

      {feedback.kind === "bulk" ? (
        <p className="mt-3 text-sm">
          <span className="font-medium text-teal">
            {feedback.created} task{feedback.created === 1 ? "" : "s"} created
          </span>
          {feedback.skipped > 0 ? (
            <span className="ml-2 text-text-muted">· {feedback.skipped} skipped</span>
          ) : null}
          {feedback.failed > 0 ? (
            <span className="ml-2 text-amber">· {feedback.failed} failed</span>
          ) : null}
        </p>
      ) : null}
      {feedback.kind === "success" ? (
        <p className="mt-3 text-sm text-teal">Added “{feedback.title}”</p>
      ) : null}
      {feedback.kind === "error" ? (
        <p className="mt-3 text-sm text-danger-ink">{feedback.message}</p>
      ) : null}
    </div>
  );
}
