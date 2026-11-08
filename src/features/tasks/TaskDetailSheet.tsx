"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

import { deleteTask, updateTask, updateTaskStatus } from "./actions";
import type { Task, TaskPriority, TaskStatus } from "./types";

const FIELD =
  "w-full rounded-xl border border-border bg-canvas px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-purple";

const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];
const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

/** ISO timestamp → value for <input type="datetime-local"> in the user's local time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local value (local time) → ISO timestamp, or null if cleared. */
function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function TaskDetailSheet({ task, onClose }: { task: Task; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [dueLocal, setDueLocal] = useState(toLocalInput(task.dueAt ?? null));
  const [estimate, setEstimate] = useState(
    task.estimatedMinutes !== null ? String(task.estimatedMinutes) : "",
  );

  // Escape closes the sheet. A modal that can only be dismissed by pointing at
  // it is a trap for anyone navigating by keyboard, and it is the behaviour
  // every dialog convention leads people to expect.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  const [tags, setTags] = useState(task.tags.join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(): Promise<void> {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Title can't be empty.");
      return;
    }
    setBusy(true);
    setError(null);

    const dueAtIso = fromLocalInput(dueLocal);
    const estimatedMinutes = estimate.trim() ? Number(estimate) : undefined;
    if (
      estimatedMinutes !== undefined &&
      (!Number.isFinite(estimatedMinutes) || estimatedMinutes <= 0)
    ) {
      setBusy(false);
      setError("Estimate must be a positive number of minutes.");
      return;
    }

    const result = await updateTask(task.id, {
      title: trimmed,
      description: description.trim(),
      priority,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      ...(dueAtIso !== null ? { dueAt: dueAtIso } : {}),
      ...(estimatedMinutes !== undefined ? { estimatedMinutes } : {}),
    });

    if (!result.ok) {
      setBusy(false);
      setError("Couldn't save changes. Please try again.");
      return;
    }

    if (status !== task.status) {
      const statusResult = await updateTaskStatus(task.id, status);
      if (!statusResult.ok) {
        setBusy(false);
        setError("Saved fields, but couldn't update status.");
        return;
      }
    }

    setBusy(false);
    router.refresh();
    onClose();
  }

  async function remove(): Promise<void> {
    setBusy(true);
    setError(null);
    const result = await deleteTask(task.id);
    if (!result.ok) {
      setBusy(false);
      setError("Couldn't delete this task.");
      return;
    }
    setBusy(false);
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/*
        The dismiss backdrop is a real <button>, not a div with onClick. As a
        div it was unreachable by keyboard and invisible to assistive tech, so
        the only way out of this sheet was a mouse. Being a sibling of the
        dialog rather than its parent also removes the stopPropagation that
        previously stopped every click inside the sheet from closing it.
      */}
      <button
        type="button"
        aria-label="Close task editor"
        className="absolute inset-0 h-full w-full cursor-default bg-black/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit task"
        className="relative flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto border-l border-border bg-card p-5 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edit task</h2>
          <Button variant="ghost" onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </div>

        <label className="space-y-1">
          <span className="text-xs text-text-secondary">Title</span>
          <input
            className={FIELD}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs text-text-secondary">Description</span>
          <Textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={busy}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs text-text-secondary">Priority</span>
            <select
              className={FIELD}
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              disabled={busy}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs text-text-secondary">Status</span>
            <select
              className={FIELD}
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              disabled={busy}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs text-text-secondary">Deadline</span>
            <input
              type="datetime-local"
              className={FIELD}
              value={dueLocal}
              onChange={(e) => setDueLocal(e.target.value)}
              disabled={busy}
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-text-secondary">Estimate (min)</span>
            <input
              type="number"
              min={1}
              className={FIELD}
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
              disabled={busy}
            />
          </label>
        </div>

        <label className="space-y-1">
          <span className="text-xs text-text-secondary">Tags (comma-separated)</span>
          <input
            className={FIELD}
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            disabled={busy}
          />
        </label>

        {error ? <p className="text-sm text-danger-ink">{error}</p> : null}

        <div className="mt-auto flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            className="text-danger-ink"
            onClick={() => void remove()}
            disabled={busy}
          >
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
