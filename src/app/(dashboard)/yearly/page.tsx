import { CalendarClock } from "lucide-react";

import { PageHeader } from "@/components/layout";
import { EmptyState } from "@/components/shared";

export default function YearlyPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Yearly" crumbs={[{ label: "Home", href: "/" }, { label: "Yearly" }]} />
      <EmptyState
        icon={CalendarClock}
        title="Coming soon"
        message="A 12-month activity heatmap, a year-in-review AI narrative, and year-over-year comparison once enough history exists."
      />
    </div>
  );
}
