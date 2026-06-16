import { CalendarClock } from "lucide-react";

import { EmptyState } from "@/components/shared";

export default function YearlyPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Yearly</h1>
      <EmptyState
        icon={CalendarClock}
        title="Coming soon"
        message="A 12-month activity heatmap, a year-in-review AI narrative, and year-over-year comparison once enough history exists."
      />
    </div>
  );
}
