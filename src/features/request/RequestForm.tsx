"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { FIELD_BASE } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { TASK_PRIORITIES, isTaskPriority } from "@/features/tasks/status";
import type { TaskPriority } from "@/features/tasks/types";

import { RequestSuccess } from "./RequestSuccess";
import { submitRequest } from "./actions";

const URGENCIES = TASK_PRIORITIES;

// The public request form shares the app's field chrome rather than keeping
// its own copy, so the two cannot drift.
const inputClass = FIELD_BASE;

export function RequestForm({ slug }: { slug: string }) {
  const [requesterName, setRequesterName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<TaskPriority>("medium");
  const [desiredDeadline, setDesiredDeadline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function reset(): void {
    setRequesterName("");
    setTitle("");
    setDescription("");
    setUrgency("medium");
    setDesiredDeadline("");
    setError(null);
    setDone(false);
  }

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    const result = await submitRequest({
      slug,
      requesterName,
      title,
      description,
      urgency,
      ...(desiredDeadline ? { desiredDeadline } : {}),
    });
    setBusy(false);
    if (result.ok) {
      setDone(true);
    } else {
      setError(
        result.error.code === "NOT_FOUND"
          ? "This request link is no longer valid."
          : "Please check the form and try again.",
      );
    }
  }

  if (done) {
    return <RequestSuccess onReset={reset} />;
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="surface space-y-4 p-6"
    >
      <div>
        <h1 className="font-display text-title-md font-bold text-text-primary">Submit a request</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Describe what you need and it&apos;ll be added to the planning board.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="requesterName" className="text-sm text-text-secondary">
          Your name
        </label>
        <input
          id="requesterName"
          required
          value={requesterName}
          onChange={(event) => setRequesterName(event.target.value)}
          className={inputClass}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="title" className="text-sm text-text-secondary">
          Title
        </label>
        <input
          id="title"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className={inputClass}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="description" className="text-sm text-text-secondary">
          Details
        </label>
        <Textarea
          id="description"
          required
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1 space-y-1">
          <label htmlFor="urgency" className="text-sm text-text-secondary">
            Urgency
          </label>
          <select
            id="urgency"
            value={urgency}
            onChange={(event) => {
              if (isTaskPriority(event.target.value)) setUrgency(event.target.value);
            }}
            className={inputClass}
          >
            {URGENCIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 space-y-1">
          <label htmlFor="desiredDeadline" className="text-sm text-text-secondary">
            Deadline (optional)
          </label>
          <input
            id="desiredDeadline"
            type="date"
            value={desiredDeadline}
            onChange={(event) => setDesiredDeadline(event.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {error ? <p className="text-sm text-danger-ink">{error}</p> : null}

      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Submitting…" : "Submit request"}
      </Button>
    </form>
  );
}
