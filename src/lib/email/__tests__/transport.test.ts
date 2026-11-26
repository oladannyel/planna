import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  env: { RESEND_API_KEY: undefined as string | undefined, EMAIL_FROM: "plAnna <no-reply@test>" },
}));

vi.mock("@/lib/env", () => ({
  get env() {
    return h.env;
  },
}));

const { sendEmail, emailConfigured } = await import("../transport");

const message = { to: "ada@example.com", subject: "Hello", text: "Body" };

beforeEach(() => {
  h.env.RESEND_API_KEY = "re_test";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(response: Response | Promise<Response>) {
  const fetchMock = vi.fn(() => Promise.resolve(response));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("sendEmail", () => {
  it("posts to Resend with the configured sender", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify({ id: "mail-1" }), { status: 200 }));

    const result = await sendEmail({ ...message, html: "<p>Body</p>" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.id).toBe("mail-1");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.from).toBe("plAnna <no-reply@test>");
    expect(body.to).toEqual(["ada@example.com"]);
    expect(body.html).toBe("<p>Body</p>");
  });

  /**
   * The classification is what the outbox acts on: a retryable failure stays
   * queued, a permanent one stops costing attempts.
   */
  it("treats 429 and 5xx as retryable", async () => {
    for (const status of [429, 500, 502]) {
      stubFetch(new Response("slow down", { status }));
      const result = await sendEmail(message);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.retryable).toBe(true);
    }
  });

  it("treats a rejected address as permanent", async () => {
    stubFetch(new Response("invalid to", { status: 422 }));
    const result = await sendEmail(message);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.retryable).toBe(false);
      expect(result.error.message).toContain("422");
    }
  });

  it("treats a network failure as retryable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("ECONNRESET"))),
    );
    const result = await sendEmail(message);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.retryable).toBe(true);
  });

  /**
   * A self-hosted clone has no email account (D5). The send must not claim
   * success, or the outbox row would be marked sent and the backlog lost the
   * moment a key is configured.
   */
  it("reports a retryable failure, and sends nothing, with no API key", async () => {
    h.env.RESEND_API_KEY = undefined;
    const fetchMock = stubFetch(new Response("{}", { status: 200 }));

    const result = await sendEmail(message);

    expect(emailConfigured()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.retryable).toBe(true);
  });
});
