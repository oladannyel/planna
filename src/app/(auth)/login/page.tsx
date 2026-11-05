"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string };

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;

  async function signInWithMagicLink(): Promise<void> {
    setStatus({ kind: "loading" });
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      ...(redirectTo ? { options: { emailRedirectTo: redirectTo } } : {}),
    });
    setStatus(error ? { kind: "error", message: error.message } : { kind: "sent", email });
  }

  const isLoading = status.kind === "loading";

  return (
    <div className="surface p-8">
      <h1 className="font-display text-title-lg font-bold text-text-primary">plAnna</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Plan, execute, and reflect — with a little AI.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void signInWithMagicLink();
        }}
        className="mt-6 space-y-3"
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
          disabled={isLoading || email.length === 0}
          className="inline-flex w-full items-center justify-center rounded-lg bg-purple px-4 py-2.5 text-sm font-medium text-white shadow-theme-xs transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Sending…" : "Send magic link"}
        </button>
      </form>

      {status.kind === "sent" && (
        <p className="mt-4 text-sm text-teal">Check {status.email} for your sign-in link.</p>
      )}
      {status.kind === "error" && <p className="mt-4 text-sm text-danger-ink">{status.message}</p>}
    </div>
  );
}
