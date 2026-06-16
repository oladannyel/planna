import type { InsightStats } from "@/features/analytics/metrics";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-text-secondary">{label}</p>
    </div>
  );
}

export function MonthlyStats({ stats, bestStreak }: { stats: InsightStats; bestStreak: number }) {
  const cards = [
    { label: "Created", value: String(stats.totalCreated) },
    { label: "Completion", value: `${stats.completionRate}%` },
    { label: "Carryover", value: `${stats.carryoverRate}%` },
    { label: "On-time", value: `${stats.onTimeRate}%` },
    { label: "Best streak", value: `${bestStreak}d` },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <StatCard key={card.label} label={card.label} value={card.value} />
      ))}
    </div>
  );
}
