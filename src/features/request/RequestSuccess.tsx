import { CheckCircle2 } from "lucide-react";

export function RequestSuccess({ onReset }: { onReset: () => void }) {
  return (
    <div className="surface p-8 text-center">
      <CheckCircle2 className="mx-auto h-10 w-10 text-teal" aria-hidden />
      <h2 className="mt-4 text-lg font-medium">Request submitted</h2>
      <p className="mt-1 text-sm text-text-secondary">
        Thanks — your request has been added. You can close this page.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-6 text-sm font-medium text-purple-ink hover:underline"
      >
        Submit another request
      </button>
    </div>
  );
}
