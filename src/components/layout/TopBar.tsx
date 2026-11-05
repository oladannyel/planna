import { ThemeToggler } from "@/components/theme";

export function TopBar({ email }: { email: string }) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-card/50 px-4 py-3 backdrop-blur md:px-6">
      <span className="truncate text-sm text-text-secondary">{email}</span>
      <div className="flex items-center gap-2">
        <ThemeToggler />
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-lg px-3 py-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
