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
});
