"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { FIELD_BASE } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { TASK_PRIORITIES, isTaskPriority } from "@/features/tasks/status";
import type { TaskPriority } from "@/features/tasks/types";
import type { AppError } from "@/lib/result";

import { RequestSuccess } from "./RequestSuccess";
import { submitRequest } from "./actions";

const URGENCIES = TASK_PRIORITIES;

// The public request form shares the app's field chrome rather than keeping
// its own copy, so the two cannot drift.
const inputClass = FIELD_BASE;

/**
 * Tell the submitter what actually went wrong. A throttled or unknown link is
 * not a validation problem, and saying "check the form" sends them off to
 * re-read input that was fine.
 */
function submitErrorMessage(error: AppError): string {
  switch (error.code) {
    case "NOT_FOUND":
      return "This request link is no longer valid.";
    case "RATE_LIMIT":
      return "This workspace has received a lot of requests just now. Please try again later.";
    case "VALIDATION_ERROR":
      return "Please check the form and try again.";
    default:
      return "Something went wrong sending your request. Please try again.";
  }
}

/**
 * The public request form.
 *
 * `ownerName` is whoever handed out the link. The submitter is writing to a
 * person, not to a system, and the heading says so.
 */
export function RequestForm({ slug, ownerName }: { slug: string; ownerName?: string | null }) {
  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<TaskPriority>("medium");
  const [desiredDeadline, setDesiredDeadline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [statusUrl, setStatusUrl] = useState<string | null>(null);

  function reset(): void {
    setRequesterName("");
    setRequesterEmail("");
    setTitle("");
    setDescription("");
    setUrgency("medium");
    setDesiredDeadline("");
    setError(null);
    setDone(false);
    setStatusUrl(null);
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
      ...(requesterEmail.trim() ? { requesterEmail: requesterEmail.trim() } : {}),
      ...(desiredDeadline ? { desiredDeadline } : {}),
    });
    setBusy(false);
    if (result.ok) {
      setStatusUrl(result.value.statusUrl);
      setDone(true);
    } else {
      setError(submitErrorMessage(result.error));
    }
  }

  if (done) {
    return (
      <RequestSuccess
        onReset={reset}
        statusUrl={statusUrl}
        emailed={requesterEmail.trim().length > 0}
      />
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="surface space-y-5 p-6 shadow-theme-xl sm:p-7"
    >
      <div>
        <h1 className="font-display text-title-md font-bold text-text-primary">
          {ownerName ? `Submit a request to ${ownerName}` : "Submit a request"}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          {ownerName
            ? `Describe what you need. ${ownerName} decides whether to take it on, and you'll be told either way.`
            : "Describe what you need. The owner decides whether to take it on, and you'll be told either way."}
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="requesterName" className="block text-sm font-medium text-text-secondary">
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
        <label htmlFor="requesterEmail" className="block text-sm font-medium text-text-secondary">
          Your email <span className="text-text-muted">(optional)</span>
        </label>
        <input
          id="requesterEmail"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={requesterEmail}
          onChange={(event) => setRequesterEmail(event.target.value)}
          className={inputClass}
          aria-describedby="requesterEmail-help"
        />
        <p id="requesterEmail-help" className="text-xs text-text-muted">
          Only used to tell you whether this was accepted and when it is done.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="title" className="block text-sm font-medium text-text-secondary">
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
        <label htmlFor="description" className="block text-sm font-medium text-text-secondary">
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
          <label htmlFor="urgency" className="block text-sm font-medium text-text-secondary">
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
          <label
            htmlFor="desiredDeadline"
            className="block text-sm font-medium text-text-secondary"
          >
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
