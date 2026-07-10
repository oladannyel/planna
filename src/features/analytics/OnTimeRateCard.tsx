interface OnTimeRateCardProps {
  onTimeRate: number;
  scheduledRate: number;
  completionRate: number;
  carryoverRate: number;
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <p className={`text-2xl font-bold ${tone}`}>{value}%</p>
      <p className="text-xs text-text-secondary">{label}</p>
    </div>
  );
}

export function OnTimeRateCard({
  onTimeRate,
  scheduledRate,
  completionRate,
  carryoverRate,
}: OnTimeRateCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium text-text-secondary">Rates</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="On time" value={onTimeRate} tone="text-teal" />
        <Stat label="Scheduled" value={scheduledRate} tone="text-text-primary" />
        <Stat label="Completed" value={completionRate} tone="text-purple" />
        <Stat label="Carried over" value={carryoverRate} tone="text-amber" />
      </div>
      <p className="mt-3 text-xs text-text-muted">
        On-time counts only tasks that had a deadline. Scheduled shows how much of your work has a
        deadline set.
      </p>
    </div>
  );
}
