import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";

/**
 * Google OAuth for the Gmail intake (ADR 0002).
 *
 * `gmail.modify` and nothing wider: it reads the messages the owner's query
 * matches and removes the label once they are ingested. It cannot delete
 * mail, and it cannot send any.
 */
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.modify";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

const TIMEOUT_MS = 10_000;

/** How long a consent round trip may take before its state is stale. */
export const STATE_TTL_MS = 10 * 60 * 1000;

export function oauthConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function callbackUrl(origin: string): string {
  return `${origin.replace(/\/+$/, "")}/api/email/callback`;
}

// ─── State ───────────────────────────────────────────────────────────────────

/**
 * The `state` parameter, signed and time-boxed.
 *
 * Signed so a caller cannot hand us a state naming someone else's workspace,
 * and time-boxed so one captured from a browser history is not good forever.
 * The nonce inside it is also set as an httpOnly cookie and compared on the
 * way back, which is what makes a replayed callback useless to anyone but the
 * browser that started the flow.
 */
export interface OAuthState {
  workspaceId: string;
  nonce: string;
  issuedAt: number;
}

function stateKey(): string {
  // The sealing key doubles as the signing key. It is the one 32-byte secret
  // this feature already requires, and a second env var that must be set for
  // the feature to work at all is a second thing to get wrong.
  const key = env.EMAIL_TOKEN_KEY;
  if (!key) throw new Error("EMAIL_TOKEN_KEY is required to sign the OAuth state");
  return key;
}

function sign(payload: string): string {
  return createHmac("sha256", stateKey()).update(payload).digest("base64url");
}

export function encodeState(workspaceId: string): { state: string; nonce: string } {
  const nonce = randomBytes(16).toString("hex");
  const payload = Buffer.from(
    JSON.stringify({ workspaceId, nonce, issuedAt: Date.now() } satisfies OAuthState),
  ).toString("base64url");

  return { state: `${payload}.${sign(payload)}`, nonce };
}

export function decodeState(state: string, now = Date.now()): OAuthState | null {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload), "utf8");
  const received = Buffer.from(signature, "utf8");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthState;
    if (typeof parsed.workspaceId !== "string" || typeof parsed.nonce !== "string") return null;
    if (!Number.isFinite(parsed.issuedAt) || now - parsed.issuedAt > STATE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ─── Consent ─────────────────────────────────────────────────────────────────

export function consentUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: callbackUrl(origin),
    response_type: "code",
    scope: GMAIL_SCOPE,
    // Offline plus an explicit consent prompt: without both, a re-connect
    // returns no refresh token at all, because Google only issues one the
    // first time an account grants a scope. The flow then appears to succeed
    // and the poll has nothing to authenticate with.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

// ─── Token endpoint ──────────────────────────────────────────────────────────

async function postForm(url: string, body: URLSearchParams): Promise<Result<unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return err({
        code: "DB_ERROR",
        message: `Google responded ${response.status}: ${detail.slice(0, 200)}`,
      });
    }

    return ok(await response.json());
  } catch (cause) {
    return err({ code: "DB_ERROR", message: `Google request failed: ${String(cause)}` });
  } finally {
    clearTimeout(timeout);
  }
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string | null;
  expiresInSeconds: number;
}

/** Swap the one-time code for tokens. */
export async function exchangeCode(code: string, origin: string): Promise<Result<TokenSet>> {
  const result = await postForm(
    TOKEN_ENDPOINT,
    new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID ?? "",
      client_secret: env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: callbackUrl(origin),
      grant_type: "authorization_code",
    }),
  );
  if (!result.ok) return result;

  const body = result.value as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!body.access_token) {
    return err({ code: "DB_ERROR", message: "Google returned no access token" });
  }

  return ok({
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    expiresInSeconds: body.expires_in ?? 3600,
  });
}

/** Trade the stored refresh token for a short-lived access token. */
export async function refreshAccessToken(refreshToken: string): Promise<Result<string>> {
  const result = await postForm(
    TOKEN_ENDPOINT,
    new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.GOOGLE_CLIENT_ID ?? "",
      client_secret: env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    }),
  );
  if (!result.ok) return result;

  const body = result.value as { access_token?: string };
  if (!body.access_token) {
    return err({ code: "UNAUTHORIZED", message: "Google refused the refresh token" });
  }
  return ok(body.access_token);
}

/**
 * Revoke at Google as well as deleting the row. Deleting our copy alone
 * leaves a live grant on the owner's account that nothing in this app can
 * show them.
 */
export async function revokeToken(token: string): Promise<Result<null>> {
  const result = await postForm(REVOKE_ENDPOINT, new URLSearchParams({ token }));
  return result.ok ? ok(null) : result;
}
