"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

import { GoogleMark } from "./GoogleMark";
import { describeSignInError, readAuthError } from "./auth-error";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "redirecting" }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string };

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    const message = readAuthError(window.location.search, window.location.hash);
    if (!message) return;
    /*
     * The URL is an external system, and a fragment does not exist during
     * SSR at all, so this cannot seed useState without a hydration mismatch.
     * This is the rule's own escape hatch; it cannot tell, because the read
     * is synchronous.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLinkError(message);

    // Strip the error from the address bar once read, so a refresh does not
    // re-report a failure already dealt with, and the fragment does not
    // survive every later navigation on this page.
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;

  async function signInWithMagicLink(): Promise<void> {
    // A fresh attempt supersedes whatever the last link did.
    setLinkError(null);
    setStatus({ kind: "loading" });
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      ...(redirectTo ? { options: { emailRedirectTo: redirectTo } } : {}),
    });
    setStatus(
      error
        ? { kind: "error", message: describeSignInError(error.message) }
        : { kind: "sent", email },
    );
  }

  /**
   * Google hands back the same `?code=` that the magic link does, so
   * /auth/callback needs no special case — the one exchange serves both.
   *
   * There is no success state to render: on success the browser leaves for
   * Google, so the only thing that can land back here is a failure.
   */
  async function signInWithGoogle(): Promise<void> {
    setLinkError(null);
    setStatus({ kind: "redirecting" });
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      ...(redirectTo ? { options: { redirectTo } } : {}),
    });
    if (error) setStatus({ kind: "error", message: describeSignInError(error.message) });
  }

  const isLoading = status.kind === "loading";
  const isBusy = isLoading || status.kind === "redirecting";

  return (
    <div className="surface p-8">
      <h1 className="font-display text-title-lg font-bold text-text-primary">plAnna</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Plan, execute, and reflect — with a little AI.
      </p>

      <button
        type="button"
        onClick={() => void signInWithGoogle()}
        disabled={isBusy}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-text-primary shadow-theme-xs transition-colors hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-50"
      >
        <GoogleMark />
        {status.kind === "redirecting" ? "Redirecting…" : "Continue with Google"}
      </button>

      <div className="my-5 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-text-muted">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void signInWithMagicLink();
        }}
        className="space-y-3"
      >
        <label htmlFor="email" className="block text-sm text-text-secondary">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-border bg-canvas px-3.5 py-2.5 text-sm text-text-primary shadow-theme-xs outline-none transition-colors placeholder:text-text-muted focus:border-purple focus:ring-4 focus:ring-purple/10"
        />
        <button
          type="submit"
          disabled={isBusy || email.length === 0}
          className="inline-flex w-full items-center justify-center rounded-lg bg-purple px-4 py-2.5 text-sm font-medium text-white shadow-theme-xs transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Sending…" : "Send magic link"}
        </button>
      </form>

      {linkError !== null && status.kind === "idle" && (
        <p role="alert" className="mt-4 text-sm text-danger-ink">
          {linkError}
        </p>
      )}
      {status.kind === "sent" && (
        <p className="mt-4 text-sm text-teal">Check {status.email} for your sign-in link.</p>
      )}
      {status.kind === "error" && <p className="mt-4 text-sm text-danger-ink">{status.message}</p>}
    </div>
  );
}
