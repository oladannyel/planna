import { CheckCircle2, CircleDashed, Clock, PlayCircle, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/shared";

import type { RequestStatusView } from "./types";

interface Step {
  key: string;
  label: string;
  detail: string;
  icon: LucideIcon;
  /** Reached: filled. Not reached: outlined and muted. */
  done: boolean;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * The timeline the requester sees.
 *
 * Deliberately not a mirror of the owner's board: a requester wants to know
 * whether their thing is happening, not which column it sits in. The four
 * steps are the four answers to that question.
 */
function stepsFor(view: RequestStatusView): Step[] {
  const who = view.ownerName ?? "The owner";

  if (view.state === "rejected") {
    return [
      {
        key: "sent",
        label: "Sent",
        detail: formatWhen(view.createdAt),
        icon: CheckCircle2,
        done: true,
      },
      {
        key: "declined",
        label: "Declined",
        detail: view.declineReason
          ? `${who} declined: ${view.declineReason}`
          : `${who} declined this request.`,
        icon: XCircle,
        done: true,
      },
    ];
  }

  const accepted = view.state === "accepted";
  const started = view.taskStatus === "in_progress" || view.taskStatus === "done";
  const finished = view.taskStatus === "done";
  const cancelled = view.taskStatus === "cancelled";

  return [
    {
      key: "sent",
      label: "Sent",
      detail: formatWhen(view.createdAt),
      icon: CheckCircle2,
      done: true,
    },
    {
      key: "accepted",
      label: accepted ? "Accepted" : "Waiting for a decision",
      detail: accepted ? formatWhen(view.decidedAt) : `${who} has not decided yet.`,
      icon: accepted ? CheckCircle2 : Clock,
      done: accepted,
    },
    {
      key: "progress",
      label: cancelled ? "Cancelled" : "In progress",
      detail: cancelled
        ? `${who} cancelled the work.`
        : started
          ? `${who} started this.`
          : "Not started yet.",
      icon: cancelled ? XCircle : started ? PlayCircle : CircleDashed,
      done: started || cancelled,
    },
    {
      key: "done",
      label: "Done",
      detail: finished ? formatWhen(view.completedAt) : "Not finished yet.",
      icon: finished ? CheckCircle2 : CircleDashed,
      done: finished,
    },
  ];
}

export function RequestStatusCard({ view }: { view: RequestStatusView }) {
  const steps = stepsFor(view);
  const tone =
    view.state === "rejected" ? "muted" : view.state === "accepted" ? "success" : "warning";
  const label =
    view.state === "rejected" ? "Declined" : view.state === "accepted" ? "Accepted" : "Pending";

  return (
    <div className="surface space-y-6 p-6 sm:p-7">
      <div className="space-y-2">
        <Badge tone={tone}>{label}</Badge>
        <h1 className="font-display text-title-md font-bold text-text-primary">{view.title}</h1>
        <p className="text-sm text-text-secondary">
          Filed by {view.requesterName}
          {view.ownerName ? ` · for ${view.ownerName}` : ""}
        </p>
      </div>

      <p className="whitespace-pre-wrap rounded-xl bg-card-hover p-4 text-sm text-text-secondary">
        {view.description}
      </p>

      <ol className="space-y-4">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <li key={step.key} className="flex gap-3">
              <Icon
                className={`mt-0.5 h-5 w-5 shrink-0 ${step.done ? "text-purple" : "text-text-muted"}`}
                aria-hidden
              />
              <div className="min-w-0">
                <p
                  className={`text-sm font-medium ${step.done ? "text-text-primary" : "text-text-muted"}`}
                >
                  {step.label}
                </p>
                {step.detail ? <p className="text-sm text-text-secondary">{step.detail}</p> : null}
              </div>
            </li>
          );
        })}
      </ol>

      <p className="text-xs text-text-muted">
        Keep this link to check back. It updates as the work moves.
      </p>
    </div>
  );
}
