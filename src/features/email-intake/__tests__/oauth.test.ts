import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted((): { env: Record<string, string | undefined> } => ({
  env: {
    // A fixed 32-byte key. `vi.hoisted` runs before every import, so this
    // block cannot reach node:crypto or a const declared above it.
    EMAIL_TOKEN_KEY: "cGxhbm5hLXRlc3Qta2V5LTMyLWJ5dGVzLWxvbmchISE=",
    GOOGLE_CLIENT_ID: "client-id",
    GOOGLE_CLIENT_SECRET: "client-secret",
  },
}));

vi.mock("@/lib/env", () => ({
  get env() {
    return h.env;
  },
}));

const {
  consentUrl,
  decodeState,
  encodeState,
  exchangeCode,
  oauthConfigured,
  refreshAccessToken,
  revokeToken,
  callbackUrl,
  STATE_TTL_MS,
  GMAIL_SCOPE,
} = await import("../oauth");

const ORIGIN = "https://planna.test";

beforeEach(() => {
  h.env.GOOGLE_CLIENT_ID = "client-id";
  h.env.GOOGLE_CLIENT_SECRET = "client-secret";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("consent URL", () => {
  it("asks for offline access and forces the consent screen", () => {
    const url = new URL(consentUrl(ORIGIN, "state-1"));
    expect(url.searchParams.get("access_type")).toBe("offline");
    // Without prompt=consent a re-connect returns no refresh token at all.
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("state-1");
    expect(url.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/api/email/callback`);
  });

  /** Read access plus labelling. Never deletion, never sending. */
  it("asks only for gmail.modify", () => {
    expect(GMAIL_SCOPE).toBe("https://www.googleapis.com/auth/gmail.modify");
    expect(new URL(consentUrl(ORIGIN, "s")).searchParams.get("scope")).toBe(GMAIL_SCOPE);
  });

  it("builds the callback without doubling a trailing slash", () => {
    expect(callbackUrl("https://planna.test/")).toBe("https://planna.test/api/email/callback");
  });

  it("knows when no OAuth client is configured", () => {
    h.env.GOOGLE_CLIENT_ID = undefined;
    expect(oauthConfigured()).toBe(false);
  });
});

describe("state", () => {
  it("round-trips the workspace it was issued for", () => {
    const { state, nonce } = encodeState("ws-1");
    const decoded = decodeState(state);
    expect(decoded?.workspaceId).toBe("ws-1");
    expect(decoded?.nonce).toBe(nonce);
  });

  /** Otherwise a caller could hand us a state naming someone else's workspace. */
  it("rejects a forged or edited state", () => {
    const { state } = encodeState("ws-1");
    const [payload] = state.split(".");
    expect(decodeState(`${payload}.not-the-signature`)).toBeNull();

    const forged = Buffer.from(
      JSON.stringify({ workspaceId: "ws-2", nonce: "n", issuedAt: Date.now() }),
    ).toString("base64url");
    expect(decodeState(`${forged}.${state.split(".")[1]}`)).toBeNull();
  });

  it("rejects a state older than its window", () => {
    const { state } = encodeState("ws-1");
    expect(decodeState(state, Date.now() + STATE_TTL_MS + 1000)).toBeNull();
  });

  it("rejects nonsense", () => {
    expect(decodeState("")).toBeNull();
    expect(decodeState("no-dot")).toBeNull();
  });
});

function stubFetch(responses: Response[]) {
  const fetchMock = vi.fn(() => Promise.resolve(responses.shift() ?? new Response("{}")));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("token endpoint", () => {
  it("exchanges a code for both tokens", async () => {
    const fetchMock = stubFetch([
      new Response(JSON.stringify({ access_token: "at", refresh_token: "rt", expires_in: 3599 }), {
        status: 200,
      }),
    ]);

    const result = await exchangeCode("code-1", ORIGIN);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.accessToken).toBe("at");
      expect(result.value.refreshToken).toBe("rt");
    }
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe("https://oauth2.googleapis.com/token");
  });

  it("reports a refusal rather than returning an empty token", async () => {
    stubFetch([new Response("invalid_grant", { status: 400 })]);
    const result = await exchangeCode("code-1", ORIGIN);
    expect(result.ok).toBe(false);
  });

  it("treats a response with no access token as a failure", async () => {
    stubFetch([new Response(JSON.stringify({ expires_in: 60 }), { status: 200 })]);
    const result = await exchangeCode("code-1", ORIGIN);
    expect(result.ok).toBe(false);
  });

  it("refreshes an access token", async () => {
    stubFetch([new Response(JSON.stringify({ access_token: "fresh" }), { status: 200 })]);
    const result = await refreshAccessToken("rt");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("fresh");
  });

  /** A revoked grant must surface as UNAUTHORIZED so the poll stops retrying. */
  it("reports a refused refresh token as unauthorised", async () => {
    stubFetch([new Response(JSON.stringify({}), { status: 200 })]);
    const result = await refreshAccessToken("rt");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UNAUTHORIZED");
  });

  it("revokes at Google", async () => {
    const fetchMock = stubFetch([new Response("{}", { status: 200 })]);
    const result = await revokeToken("rt");
    expect(result.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe("https://oauth2.googleapis.com/revoke");
  });

  it("reports a network failure instead of throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("ECONNRESET"))),
    );
    const result = await refreshAccessToken("rt");
    expect(result.ok).toBe(false);
  });
});
