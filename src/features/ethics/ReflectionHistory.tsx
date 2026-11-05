import type { Reflection } from "./types";

export function ReflectionHistory({ reflections }: { reflections: Reflection[] }) {
  if (reflections.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-text-secondary">Past reflections</h2>
      {reflections.map((reflection) => (
        <div key={reflection.weekStart} className="surface p-4">
          <p className="mb-2 text-xs text-text-muted">Week of {reflection.weekStart}</p>
          <ul className="space-y-2">
            {reflection.answers.map((answer, index) => (
              <li key={`${reflection.weekStart}-${String(index)}`}>
                <p className="text-sm font-medium">{answer.question}</p>
                <p className="text-sm text-text-secondary">{answer.answer}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
