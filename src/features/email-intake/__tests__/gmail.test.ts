import { afterEach, describe, expect, it, vi } from "vitest";

import {
  extractPlainText,
  getMessage,
  labelFromQuery,
  labelIdByName,
  listMessageIds,
  mailboxAddress,
  markHandled,
} from "../gmail";

const TOKEN = "access-token";

function encode(text: string): string {
  return Buffer.from(text, "utf8").toString("base64url");
}

function stubFetch(response: Response) {
  const fetchMock = vi.fn(() => Promise.resolve(response));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("extractPlainText", () => {
  /** A real Gmail message is a tree, and the text part is rarely at the top. */
  it("finds the text part inside a nested multipart message", () => {
    const message = {
      id: "m1",
      payload: {
        mimeType: "multipart/mixed",
        parts: [
          {
            mimeType: "multipart/alternative",
            parts: [
              { mimeType: "text/plain", body: { data: encode("  Ship the invoice by Friday  ") } },
              { mimeType: "text/html", body: { data: encode("<p>Ship it</p>") } },
            ],
          },
          { mimeType: "application/pdf", body: { data: encode("binary") } },
        ],
      },
    };

    expect(extractPlainText(message)).toBe("Ship the invoice by Friday");
  });

  it("reads a single-part message from the payload body", () => {
    expect(extractPlainText({ id: "m", payload: { body: { data: encode("Just this") } } })).toBe(
      "Just this",
    );
  });

  /** Better a stripped summary than a wall of HTML in the prompt. */
  it("falls back to the snippet when there is no text part", () => {
    expect(
      extractPlainText({
        id: "m",
        snippet: "Short summary",
        payload: { mimeType: "text/html", body: { data: encode("<p>x</p>") } },
      }),
    ).toBe("Short summary");
  });

  it("returns empty string when there is nothing at all", () => {
    expect(extractPlainText({ id: "m" })).toBe("");
  });
});

describe("labelFromQuery", () => {
  it("picks the label a query watches", () => {
    expect(labelFromQuery("label:plAnna")).toBe("plAnna");
    expect(labelFromQuery('is:unread label:"To Do"')).toBe("To Do");
    expect(labelFromQuery("from:boss@example.com")).toBeNull();
  });
});

describe("Gmail calls", () => {
  it("reads the mailbox address", async () => {
    stubFetch(new Response(JSON.stringify({ emailAddress: "me@example.com" }), { status: 200 }));
    const result = await mailboxAddress(TOKEN);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("me@example.com");
  });

  it("lists message ids for a query", async () => {
    const fetchMock = stubFetch(
      new Response(JSON.stringify({ messages: [{ id: "a" }, { id: "b" }] }), { status: 200 }),
    );

    const result = await listMessageIds(TOKEN, "label:plAnna", 5);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(["a", "b"]);
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain("q=label%3AplAnna");
    expect(url).toContain("maxResults=5");
  });

  it("treats an empty mailbox as an empty list, not an error", async () => {
    stubFetch(new Response(JSON.stringify({}), { status: 200 }));
    const result = await listMessageIds(TOKEN, "label:plAnna");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([]);
  });

  it("maps a message to subject, sender and body", async () => {
    stubFetch(
      new Response(
        JSON.stringify({
          id: "m1",
          internalDate: "1795683600000",
          payload: {
            headers: [
              { name: "Subject", value: "Invoice" },
              { name: "From", value: "Ada <ada@example.com>" },
            ],
            mimeType: "text/plain",
            body: { data: encode("Pay it") },
          },
        }),
        { status: 200 },
      ),
    );

    const result = await getMessage(TOKEN, "m1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.subject).toBe("Invoice");
      expect(result.value.from).toBe("Ada <ada@example.com>");
      expect(result.value.body).toBe("Pay it");
      expect(result.value.receivedAt).toBe("2026-11-26T09:00:00.000Z");
    }
  });

  /** A revoked grant must be distinguishable from a transient failure. */
  it("reports 401 and 403 as unauthorised", async () => {
    for (const status of [401, 403]) {
      stubFetch(new Response("nope", { status }));
      const result = await listMessageIds(TOKEN, "label:plAnna");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("UNAUTHORIZED");
    }
  });

  it("reports other failures as DB_ERROR", async () => {
    stubFetch(new Response("boom", { status: 500 }));
    const result = await listMessageIds(TOKEN, "label:plAnna");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
  });

  it("resolves a label id by name, case-insensitively", async () => {
    stubFetch(
      new Response(JSON.stringify({ labels: [{ id: "Label_7", name: "plAnna" }] }), {
        status: 200,
      }),
    );
    const result = await labelIdByName(TOKEN, "planna");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("Label_7");
  });

  it("returns null for a label that does not exist", async () => {
    stubFetch(new Response(JSON.stringify({ labels: [] }), { status: 200 }));
    const result = await labelIdByName(TOKEN, "plAnna");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
  });

  it("removes the watched label and UNREAD together, without duplicates", async () => {
    const fetchMock = stubFetch(new Response("{}", { status: 200 }));

    await markHandled(TOKEN, "m1", ["Label_7", "UNREAD"]);

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ removeLabelIds: ["Label_7", "UNREAD"] });
  });
});
