import { PageHeader } from "@/components/layout";
import { RequestInbox, ShareRequestLink, ownerDisplayName } from "@/features/request";
import { publicOrigin, requestLinkFor } from "@/features/request/link";
import { listInboxRequests } from "@/features/request/queries";
import { getAuthedContext } from "@/features/workspace/queries";

export const metadata = { title: "Requests · plAnna" };

export default async function RequestsPage() {
  const [inbox, ctx, origin] = await Promise.all([
    listInboxRequests(),
    getAuthedContext(),
    publicOrigin(),
  ]);

  const items = inbox.ok ? inbox.value : [];
  const requestLink = ctx.ok ? requestLinkFor(origin, ctx.value.workspaceSlug) : null;

  // Same popover as the board header: the inbox is where someone goes when
  // they want more requests, so the link to hand out belongs here too.
  const user = ctx.ok ? (await ctx.value.supabase.auth.getUser()).data.user : null;
  const displayName = ownerDisplayName(user?.user_metadata ?? null, null);

  const pending = items.filter((item) => item.state === "pending").length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <PageHeader
          title="Requests"
          crumbs={[{ label: "Home", href: "/" }, { label: "Requests" }]}
          {...(requestLink
            ? { action: <ShareRequestLink url={requestLink} displayName={displayName} /> }
            : {})}
        />
        <p className="-mt-3 mb-2 text-sm text-text-secondary">
          {pending === 0
            ? "Nothing is waiting on you. Accepting a request puts it on your board and tells the person who asked."
            : `${pending} ${pending === 1 ? "request is" : "requests are"} waiting on your decision. Accepting one puts it on your board and tells the person who asked.`}
        </p>
      </div>

      {inbox.ok ? null : (
        <p className="text-sm text-danger-ink">Could not load your requests. Try reloading.</p>
      )}

      <RequestInbox items={items} />
    </div>
  );
}
