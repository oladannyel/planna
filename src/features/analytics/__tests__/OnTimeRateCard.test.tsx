import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OnTimeRateCard } from "../OnTimeRateCard";

describe("OnTimeRateCard", () => {
  it("renders all rates as percentages with labels", () => {
    render(
      <OnTimeRateCard onTimeRate={80} scheduledRate={40} completionRate={65} carryoverRate={12} />,
    );
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("65%")).toBeInTheDocument();
    expect(screen.getByText("12%")).toBeInTheDocument();
    expect(screen.getByText("On time")).toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Carried over")).toBeInTheDocument();
  });

  /*
   * The track is the whole point of the rewrite, and a div with a width is
   * invisible to anything that is not looking at it. Each row is a meter
   * carrying its own value, so the figure is available without sight.
   */
  it("exposes each rate as a meter, not only as a coloured width", () => {
    render(
      <OnTimeRateCard onTimeRate={80} scheduledRate={40} completionRate={65} carryoverRate={12} />,
    );

    const meters = screen.getAllByRole("meter");
    expect(meters).toHaveLength(4);
    expect(screen.getByRole("meter", { name: "On time: 80 percent" })).toHaveAttribute(
      "aria-valuenow",
      "80",
    );
  });

  it("draws the fill to the rate", () => {
    const { container } = render(
      <OnTimeRateCard onTimeRate={80} scheduledRate={40} completionRate={65} carryoverRate={12} />,
    );
    const fills = container.querySelectorAll<HTMLElement>('[role="meter"] > div');
    expect(fills[0]?.style.width).toBe("80%");
    expect(fills[3]?.style.width).toBe("12%");
  });
});
