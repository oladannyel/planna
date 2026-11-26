"use client";

import { AlertTriangle, CheckCircle2, Mail, Unplug } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/shared";
import { Button, Card, CardContent, CardHeader, CardTitle, useToast } from "@/components/ui";
import { FIELD_BASE } from "@/components/ui/Input";

import { disconnectEmail, updateEmailQuery } from "./actions";
import type { EmailConnection } from "./connection";

function formatWhen(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EmailConnectionCard({
  connection,
  notice,
}: {
  connection: EmailConnection | null;
  notice?: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState(connection?.query ?? "label:plAnna");

  async function disconnect(): Promise<void> {
    setBusy(true);
    const result = await disconnectEmail();
    setBusy(false);

    if (result.ok) {
      toast({
        title: "Mailbox disconnected",
        description: result.value.revoked
          ? "The grant was revoked at Google too."
          : "Google did not confirm the revoke — check your account's third-party access.",
        tone: result.value.revoked ? "success" : "warning",
      });
      router.refresh();
    } else {
      toast({ title: "Could not disconnect", description: result.error.message, tone: "error" });
    }
  }

  async function saveQuery(): Promise<void> {
    setBusy(true);
    const result = await updateEmailQuery(query);
    setBusy(false);

    if (result.ok) {
      toast({ title: "Search saved", description: `Polling ${result.value.query}` });
      router.refresh();
    } else {
      toast({ title: "Could not save", description: result.error.message, tone: "error" });
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>Email task intake</CardTitle>
          <p className="mt-0.5 text-sm text-text-secondary">
            Label a message in Gmail and it becomes a task here.
          </p>
        </div>
        {connection ? (
          <Badge tone={connection.state === "active" ? "success" : "danger"}>
            {connection.state === "active" ? "Connected" : "Needs attention"}
          </Badge>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-5">
        {notice ? (
          <p className="flex items-start gap-2 rounded-lg bg-danger/10 p-3 text-sm text-danger-ink">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {notice}
          </p>
        ) : null}

        {connection === null ? (
          <>
            <p className="text-sm text-text-secondary">
              plAnna reads only the messages your search matches, removes the label once each one is
              a task, and never sends mail from your account.
            </p>
            {/*
             * A link, not a button with a click handler: the connect route
             * is a plain GET that redirects, so it should be navigable,
             * middle-clickable and visible in the status bar like any link.
             */}
            <a
              href="/api/email/connect"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-purple px-4 text-sm font-medium text-white shadow-theme-xs transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              <Mail className="h-4 w-4" aria-hidden />
              Connect Gmail
            </a>
          </>
        ) : (
          <>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-text-muted">Mailbox</dt>
                <dd className="text-text-primary">{connection.emailAddress}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Last checked</dt>
                <dd className="text-text-primary">{formatWhen(connection.lastPolledAt)}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Last task made</dt>
                <dd className="text-text-primary">{formatWhen(connection.lastTaskAt)}</dd>
              </div>
            </dl>

            {connection.lastError ? (
              <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger-ink">
                Last poll failed: {connection.lastError}
              </p>
            ) : (
              <p className="flex items-center gap-2 text-sm text-text-secondary">
                <CheckCircle2 className="h-4 w-4 text-teal" aria-hidden />
                Checked once an hour.
              </p>
            )}

            <div className="space-y-2">
              <label
                htmlFor="gmail-query"
                className="block text-sm font-medium text-text-secondary"
              >
                Which messages count
              </label>
              <input
                id="gmail-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className={FIELD_BASE}
                aria-describedby="gmail-query-help"
              />
              <p id="gmail-query-help" className="text-xs text-text-muted">
                A Gmail search. Anything it matches becomes a task, so keep it narrow.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void saveQuery()} disabled={busy}>
                  Save search
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void disconnect()}
                  loading={busy}
                  startIcon={<Unplug className="h-4 w-4" aria-hidden />}
                >
                  Disconnect
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
