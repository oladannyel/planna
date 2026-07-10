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
    <div className="rounded-xl border border-border bg-card p-8">
      <h1 className="text-2xl font-bold">plAnna</h1>
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
          className="w-full rounded-xl border border-border bg-canvas px-4 py-2.5 text-text-primary outline-none placeholder:text-text-muted focus:border-purple"
        />
        <button
          type="submit"
          disabled={isLoading || email.length === 0}
          className="w-full rounded-xl bg-purple px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isLoading ? "Sending…" : "Send magic link"}
        </button>
      </form>

      {status.kind === "sent" && (
        <p className="mt-4 text-sm text-teal">Check {status.email} for your sign-in link.</p>
      )}
      {status.kind === "error" && <p className="mt-4 text-sm text-danger">{status.message}</p>}
    </div>
  );
}
