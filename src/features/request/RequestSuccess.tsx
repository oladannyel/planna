import { CheckCircle2 } from "lucide-react";

/**
 * What the requester sees after submitting.
 *
 * It no longer says "added" — nothing has been added yet, the owner has to
 * accept it first, and telling someone their request is on a board when it is
 * sitting in an inbox is the kind of small lie that produces a follow-up
 * conversation a week later.
 *
 * The status link is shown whether or not they gave an email address. With no
 * address it is the only way they will ever hear anything, so it is presented
 * as something to keep rather than as a footnote.
 */
export function RequestSuccess({
  onReset,
  statusUrl = null,
  emailed = false,
}: {
  onReset: () => void;
  statusUrl?: string | null;
  emailed?: boolean;
}) {
  return (
    <div className="surface p-8 text-center">
      <CheckCircle2 className="mx-auto h-10 w-10 text-teal" aria-hidden />
      <h2 className="mt-4 text-lg font-medium">Request sent</h2>
      <p className="mt-1 text-sm text-text-secondary">
        {emailed
          ? "You'll get an email when it is accepted or declined, and as the work moves."
          : "It is waiting for a decision."}
      </p>

      {statusUrl ? (
        <div className="mt-5 space-y-2 text-start">
          <p className="text-sm font-medium text-text-secondary">
            {emailed ? "You can also follow it here:" : "Keep this link to follow it:"}
          </p>
          <a
            href={statusUrl}
            className="block break-all rounded-lg border border-border bg-card-hover px-3 py-2 text-sm text-purple-ink hover:underline"
          >
            {statusUrl}
          </a>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onReset}
        className="mt-6 text-sm font-medium text-purple-ink hover:underline"
      >
        Submit another request
      </button>
    </div>
  );
}
