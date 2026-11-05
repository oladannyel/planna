import { ThemeToggler } from "@/components/theme";

/**
 * Split auth layout, after TailAdmin: the form on one side, a brand panel on
 * the other that collapses away below lg so small screens get the form alone.
 */
export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="flex min-h-dvh bg-canvas">
      <div className="relative flex w-full flex-col items-center justify-center px-4 py-12 lg:w-1/2">
        <div className="absolute end-4 top-4">
          <ThemeToggler />
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </div>

      <aside
        aria-hidden
        className="relative hidden w-1/2 flex-col items-center justify-center overflow-hidden bg-brand-950 p-12 lg:flex"
      >
        {/* Soft brand wash, drawn rather than imported, so there is no asset to ship. */}
        <div className="absolute -start-24 -top-24 h-96 w-96 rounded-full bg-brand-600/30 blur-3xl" />
        <div className="absolute -bottom-24 -end-24 h-96 w-96 rounded-full bg-teal/20 blur-3xl" />

        <div className="relative max-w-md text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-purple font-display text-2xl font-bold text-white">
            p
          </span>
          <h2 className="mt-6 font-display text-heading-six font-bold text-white">
            A to-do list that talks back
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-brand-200">
            Write one sentence about your day. plAnna turns it into a tracked board, then shows you
            where your attention actually went.
          </p>
        </div>
      </aside>
    </main>
  );
}
