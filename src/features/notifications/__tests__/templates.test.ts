import { describe, expect, it } from "vitest";

import {
  escapeHtml,
  ownerNewRequest,
  requesterAccepted,
  requesterProgress,
  requesterReceived,
  requesterRejected,
  truncate,
} from "../templates";

const request = {
  requesterName: "Ada",
  title: "Fix the CSV export",
  description: "The last row is dropped for large datasets.",
  urgency: "high",
  ownerName: "Daniel",
};

describe("escapeHtml", () => {
  /**
   * Every name, title and description in these mails is typed by whoever
   * filed the request. An unescaped one is a script tag in the owner's inbox.
   */
  it("neutralises markup", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
    expect(escapeHtml("Tom & Jerry's")).toBe("Tom &amp; Jerry&#39;s");
  });
});

describe("truncate", () => {
  it("leaves short text alone and ellipsises the rest", () => {
    expect(truncate("short", 10)).toBe("short");
    expect(truncate("a".repeat(20), 10)).toBe(`${"a".repeat(9)}…`);
  });
});

describe("owner mail", () => {
  it("names the requester and links the inbox", () => {
    const mail = ownerNewRequest(request, "https://planna.test/requests");
    expect(mail.subject).toContain("Ada");
    expect(mail.text).toContain("https://planna.test/requests");
    expect(mail.html).toContain("https://planna.test/requests");
  });

  it("escapes a hostile title in the HTML part", () => {
    const mail = ownerNewRequest(
      { ...request, title: '<img src=x onerror="steal()">' },
      "https://planna.test/requests",
    );
    expect(mail.html).not.toContain("<img");
    expect(mail.html).toContain("&lt;img");
  });
});

describe("requester mail", () => {
  const statusUrl = "https://planna.test/request/status/abc";

  it("does not claim the work has started when it has only been received", () => {
    const mail = requesterReceived(request, statusUrl);
    expect(mail.text).toContain("waiting for a decision");
    expect(mail.text).toContain(statusUrl);
  });

  it("says who accepted it", () => {
    expect(requesterAccepted(request, statusUrl).text).toContain("Daniel accepted");
  });

  it("includes a decline reason when one was given, and omits the line when not", () => {
    expect(requesterRejected(request, statusUrl, "No capacity until March").text).toContain(
      "No capacity until March",
    );
    expect(requesterRejected(request, statusUrl, null).text).not.toContain("Reason given");
  });

  it("maps each task status to wording the requester understands", () => {
    expect(requesterProgress(request, "in_progress", statusUrl)?.subject).toContain("Started");
    expect(requesterProgress(request, "done", statusUrl)?.subject).toContain("Done");
    expect(requesterProgress(request, "cancelled", statusUrl)?.subject).toContain("Cancelled");
  });

  /** An unknown status must send nothing rather than an empty mail. */
  it("returns null for a status with no wording", () => {
    expect(requesterProgress(request, "archived", statusUrl)).toBeNull();
  });

  it("falls back to a neutral noun when the owner has no display name", () => {
    const anonymous = { ...request, ownerName: null };

    expect(requesterAccepted(anonymous, statusUrl).text.startsWith("The owner accepted")).toBe(
      true,
    );
    expect(requesterReceived(anonymous, statusUrl).text).toContain("reached the owner");
    expect(requesterRejected(anonymous, statusUrl, null).text).toContain("The owner declined");
    expect(requesterProgress(anonymous, "done", statusUrl)?.text).toContain("The owner has");
  });

  it("works for an owner whose name was never set at all", () => {
    const withoutOwner = { ...request };
    delete (withoutOwner as { ownerName?: string | null }).ownerName;
    expect(requesterAccepted(withoutOwner, statusUrl).text).toContain("The owner accepted");
  });

  /** Moving a card back is a status the requester should hear about too. */
  it("has wording for a task put back in the queue", () => {
    expect(requesterProgress(request, "todo", statusUrl)?.subject).toContain("Back in the queue");
  });

  it("truncates a very long title in the subject", () => {
    const mail = requesterAccepted({ ...request, title: "T".repeat(200) }, statusUrl);
    expect(mail.subject.length).toBeLessThan(100);
  });

  it("truncates a long description with the default limit", () => {
    const mail = ownerNewRequest(
      { ...request, description: "d".repeat(900) },
      "https://planna.test/requests",
    );
    expect(mail.text).toContain("…");
  });
});
