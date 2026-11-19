import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MetricCards } from "../MetricCards";
import type { PeriodDelta } from "../metrics";

const delta = (current: number, previous: number, changePct: number | null): PeriodDelta => ({
  current,
  previous,
  changePct,
});

describe("MetricCards", () => {
  it("shows each headline value with what it is measured over", () => {
    render(
      <MetricCards
        created={delta(9, 4, 125)}
        completed={delta(1, 2, -50)}
        avgCycleTimeHours={28.8}
        openTasks={9}
      />,
    );

    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("28.8h")).toBeInTheDocument();
    expect(screen.getByText("Last 7 days · 4 before")).toBeInTheDocument();
  });

  it("states the direction of a change in words, not only in colour", () => {
    render(
      <MetricCards
        created={delta(9, 4, 125)}
        completed={delta(1, 2, -50)}
        avgCycleTimeHours={0}
        openTasks={0}
      />,
    );

    expect(screen.getByText("Up 125% on the previous 7 days")).toBeInTheDocument();
    expect(screen.getByText("Down 50% on the previous 7 days")).toBeInTheDocument();
  });

  it("says 'new' rather than inventing a percentage out of zero", () => {
    render(
      <MetricCards
        created={delta(3, 0, null)}
        completed={delta(0, 0, null)}
        avgCycleTimeHours={0}
        openTasks={3}
      />,
    );

    expect(screen.getAllByText("new")).toHaveLength(2);
    expect(screen.queryByText(/Up \d/)).not.toBeInTheDocument();
  });

  it("shows a dash rather than 0h when nothing has been completed", () => {
    render(
      <MetricCards
        created={delta(1, 1, 0)}
        completed={delta(0, 0, null)}
        avgCycleTimeHours={0}
        openTasks={1}
      />,
    );

    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
