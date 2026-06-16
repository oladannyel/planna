export default function DashboardLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-card" />
      <div className="h-24 w-full animate-pulse rounded-xl bg-card" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-64 w-72 shrink-0 animate-pulse rounded-xl bg-card/60" />
        ))}
      </div>
    </div>
  );
}
