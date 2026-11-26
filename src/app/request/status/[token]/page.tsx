import { notFound } from "next/navigation";

import { ThemeToggler } from "@/components/theme";
import { RequestStatusCard, requestStatusByToken } from "@/features/request";

/** Always live: the whole point of the page is the status right now. */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Request status · plAnna",
  // A status page carries someone's request text; it has no business in an
  // index, and the link is meant for one person.
  robots: { index: false, follow: false },
};

export default async function RequestStatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const view = await requestStatusByToken(token);

  // A bad token and a deleted request are the same answer. Nothing here
  // distinguishes "wrong token" from "no such request", which is what keeps
  // the page from being a probe for valid ones.
  if (!view) notFound();

  return (
    <main className="relative flex min-h-dvh items-start justify-center bg-canvas px-4 py-12">
      <div className="absolute end-4 top-4">
        <ThemeToggler />
      </div>
      <div className="w-full max-w-lg">
        <RequestStatusCard view={view} />
      </div>
    </main>
  );
}
