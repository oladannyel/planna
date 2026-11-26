"use client";

import { Check, Clock, Inbox, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge, EmptyState, PriorityBadge, StatusBadge } from "@/components/shared";
import { Button, Card, Textarea, useToast } from "@/components/ui";

import { acceptRequest, rejectRequest } from "./actions";
import type { RequestState, WorkRequest } from "./types";

/** What the owner sees per row, with the state of the task an accept created. */
export interface InboxItem extends WorkRequest {
  taskStatus: "todo" | "in_progress" | "done" | "cancelled" | null;
}

/** The badge tones are the app's, so a colour means the same thing here. */
const STATE_TONE = {
  pending: "warning",
  accepted: "success",
  rejected: "muted",
} as const;

const STATE_LABEL: Record<RequestState, string> = {
  pending: "Waiting on you",
  accepted: "Accepted",
  rejected: "Declined",
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RequestRow({ item }: { item: InboxItem }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState("");

  async function accept(): Promise<void> {
    setBusy("accept");
    const result = await acceptRequest(item.id);
    setBusy(null);
    if (result.ok) {
      toast({
        title: "Accepted",
        description: `"${item.title}" is on your board.`,
        tone: "success",
      });
      router.refresh();
    } else {
      toast({ title: "Could not accept", description: result.error.message, tone: "error" });
    }
  }

  async function decline(): Promise<void> {
    setBusy("reject");
    const result = await rejectRequest(item.id, reason);
    setBusy(null);
    if (result.ok) {
      setShowReason(false);
      setReason("");
      toast({
        title: "Declined",
        description: item.requesterEmail
          ? `${item.requesterName} has been emailed.`
          : `${item.requesterName} can see it on their status page.`,
      });
      router.refresh();
    } else {
      toast({ title: "Could not decline", description: result.error.message, tone: "error" });
    }
  }

  const pending = item.state === "pending";

  return (
    <li className="border-b border-border last:border-b-0">
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:gap-5">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATE_TONE[item.state]}>{STATE_LABEL[item.state]}</Badge>
            <PriorityBadge priority={item.urgency} />
            {item.taskStatus ? <StatusBadge status={item.taskStatus} /> : null}
          </div>

          <h3 className="font-medium text-text-primary">{item.title}</h3>
          <p className="whitespace-pre-wrap text-sm text-text-secondary">{item.description}</p>

          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
            <span>
              From <span className="text-text-secondary">{item.requesterName}</span>
              {item.requesterEmail ? ` · ${item.requesterEmail}` : " · no email given"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden />
              {formatWhen(item.createdAt)}
            </span>
            {item.desiredDeadline ? <span>Wanted by {item.desiredDeadline}</span> : null}
          </p>

          {item.declineReason ? (
            <p className="rounded-lg bg-card-hover px-3 py-2 text-xs text-text-secondary">
              Reason sent: {item.declineReason}
            </p>
          ) : null}
        </div>

        {pending ? (
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              onClick={() => void accept()}
              loading={busy === "accept"}
              disabled={busy !== null}
              startIcon={<Check className="h-4 w-4" aria-hidden />}
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowReason((open) => !open)}
              disabled={busy !== null}
              aria-expanded={showReason}
              startIcon={<X className="h-4 w-4" aria-hidden />}
            >
              Decline
            </Button>
          </div>
        ) : null}
      </div>

      {pending && showReason ? (
        <div className="space-y-2 px-5 pb-5">
          <label htmlFor={`reason-${item.id}`} className="block text-sm text-text-secondary">
            Reason (optional — {item.requesterName} will be sent this)
          </label>
          <Textarea
            id={`reason-${item.id}`}
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Not something I can take on this month."
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="danger"
              onClick={() => void decline()}
              loading={busy === "reject"}
            >
              Decline request
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowReason(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

/**
 * The owner's request inbox.
 *
 * Pending first (the server orders it), because this screen exists to clear
 * decisions, and decided requests are only here so the owner can see what
 * they told someone.
 */
export function RequestInbox({ items }: { items: InboxItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No requests yet"
        message="Share your request link, and anything a colleague files waits here for your decision."
      />
    );
  }

  return (
    <Card>
      <ul className="divide-y-0">
        {items.map((item) => (
          <RequestRow key={item.id} item={item} />
        ))}
      </ul>
    </Card>
  );
}
