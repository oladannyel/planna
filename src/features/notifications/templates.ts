/**
 * Mail bodies.
 *
 * Plain text is the message; the HTML is the same words with minimal markup.
 * No images, no tracking pixel, no remote CSS — a status notification is one
 * paragraph and a link, and anything more is a reason for a spam filter to
 * take an interest.
 *
 * Everything interpolated here is attacker-supplied: the requester types
 * their own name, title and description, and the owner's display name comes
 * from their profile. `escapeHtml` is applied to every one of them on the
 * HTML side, and the text side is inert by construction.
 */

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

/** Keep a quoted body to a readable size in a notification. */
export function truncate(value: string, max = 400): string {
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

export interface EmailBody {
  subject: string;
  text: string;
  html: string;
}

function layout(paragraphs: string[], action?: { label: string; href: string }): string {
  const body = paragraphs
    .map((p) => `<p style="margin:0 0 14px;line-height:1.55">${p}</p>`)
    .join("");

  const button = action
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(action.href)}" style="background:#7C3AED;color:#fff;border-radius:8px;padding:10px 18px;text-decoration:none;display:inline-block;font-weight:600">${escapeHtml(action.label)}</a></p>`
    : "";

  return [
    `<div style="font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;color:#1D2939;max-width:520px">`,
    body,
    button,
    `<p style="margin:28px 0 0;font-size:12px;color:#667085">Sent by plAnna.</p>`,
    `</div>`,
  ].join("");
}

export interface RequestSummary {
  requesterName: string;
  title: string;
  description: string;
  urgency: string;
  ownerName?: string | null;
}

/** To the owner: someone filed a request and it is waiting on them. */
export function ownerNewRequest(request: RequestSummary, inboxUrl: string): EmailBody {
  const quoted = truncate(request.description);
  return {
    subject: `New request from ${request.requesterName}: ${truncate(request.title, 80)}`,
    text: [
      `${request.requesterName} sent you a request through your plAnna link.`,
      ``,
      `${request.title}`,
      `Urgency: ${request.urgency}`,
      ``,
      quoted,
      ``,
      `Accept or decline it here: ${inboxUrl}`,
    ].join("\n"),
    html: layout(
      [
        `<strong>${escapeHtml(request.requesterName)}</strong> sent you a request through your plAnna link.`,
        `<strong>${escapeHtml(request.title)}</strong><br><span style="color:#667085">Urgency: ${escapeHtml(request.urgency)}</span>`,
        `<span style="color:#344054">${escapeHtml(quoted)}</span>`,
      ],
      { label: "Review the request", href: inboxUrl },
    ),
  };
}

/** To the requester: we have it, nobody has decided yet. */
export function requesterReceived(request: RequestSummary, statusUrl: string): EmailBody {
  const who = request.ownerName ?? "the owner";
  return {
    subject: `Request received: ${truncate(request.title, 80)}`,
    text: [
      `Thanks — your request has reached ${who} and is waiting for a decision.`,
      ``,
      `${request.title}`,
      ``,
      `You can follow it here, no account needed: ${statusUrl}`,
      `You'll get an email when it is accepted or declined, and as the work moves.`,
    ].join("\n"),
    html: layout(
      [
        `Thanks — your request has reached <strong>${escapeHtml(who)}</strong> and is waiting for a decision.`,
        `<strong>${escapeHtml(request.title)}</strong>`,
        `You'll get an email when it is accepted or declined, and as the work moves.`,
      ],
      { label: "Follow this request", href: statusUrl },
    ),
  };
}

/** To the requester: accepted, and on the board. */
export function requesterAccepted(request: RequestSummary, statusUrl: string): EmailBody {
  const who = request.ownerName ?? "The owner";
  return {
    subject: `Accepted: ${truncate(request.title, 80)}`,
    text: [
      `${who} accepted your request and added it to their board.`,
      ``,
      `${request.title}`,
      ``,
      `Follow its progress here: ${statusUrl}`,
    ].join("\n"),
    html: layout(
      [
        `<strong>${escapeHtml(who)}</strong> accepted your request and added it to their board.`,
        `<strong>${escapeHtml(request.title)}</strong>`,
      ],
      { label: "Follow its progress", href: statusUrl },
    ),
  };
}

/** To the requester: declined, with the reason if one was given. */
export function requesterRejected(
  request: RequestSummary,
  statusUrl: string,
  reason?: string | null,
): EmailBody {
  const who = request.ownerName ?? "The owner";
  const because = reason?.trim() ? `\n\nReason given: ${truncate(reason)}` : "";
  return {
    subject: `Declined: ${truncate(request.title, 80)}`,
    text: [
      `${who} declined your request, so it will not be worked on.`,
      ``,
      `${request.title}${because}`,
      ``,
      `Details: ${statusUrl}`,
    ].join("\n"),
    html: layout(
      [
        `<strong>${escapeHtml(who)}</strong> declined your request, so it will not be worked on.`,
        `<strong>${escapeHtml(request.title)}</strong>`,
        ...(reason?.trim()
          ? [`<span style="color:#344054">Reason given: ${escapeHtml(truncate(reason))}</span>`]
          : []),
      ],
      { label: "View details", href: statusUrl },
    ),
  };
}

const PROGRESS_WORDING: Record<string, { subject: string; line: string }> = {
  in_progress: { subject: "Started", line: "is working on your request now" },
  done: { subject: "Done", line: "has finished your request" },
  cancelled: { subject: "Cancelled", line: "cancelled the work on your request" },
  todo: { subject: "Back in the queue", line: "moved your request back to their to-do column" },
};

/** To the requester: the accepted task moved. */
export function requesterProgress(
  request: RequestSummary,
  status: string,
  statusUrl: string,
): EmailBody | null {
  const wording = PROGRESS_WORDING[status];
  if (!wording) return null;

  const who = request.ownerName ?? "The owner";
  return {
    subject: `${wording.subject}: ${truncate(request.title, 80)}`,
    text: [`${who} ${wording.line}.`, ``, `${request.title}`, ``, `Details: ${statusUrl}`].join(
      "\n",
    ),
    html: layout(
      [
        `<strong>${escapeHtml(who)}</strong> ${escapeHtml(wording.line)}.`,
        `<strong>${escapeHtml(request.title)}</strong>`,
      ],
      { label: "View details", href: statusUrl },
    ),
  };
}
