import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RequestStatusCard } from "../RequestStatusCard";
import type { RequestStatusView } from "../types";

function view(overrides: Partial<RequestStatusView> = {}): RequestStatusView {
  return {
    title: "Fix the export bug",
    description: "CSV export drops the last row.",
    requesterName: "Ada",
    urgency: "high",
    state: "pending",
    declineReason: null,
    createdAt: "2026-11-26T09:00:00.000Z",
    decidedAt: null,
    ownerName: "Daniel",
    taskStatus: null,
    completedAt: null,
    ...overrides,
  };
}

describe("RequestStatusCard", () => {
  it("does not claim a pending request has been agreed to", () => {
    render(<RequestStatusCard view={view()} />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Waiting for a decision")).toBeInTheDocument();
    expect(screen.getByText("Daniel has not decided yet.")).toBeInTheDocument();
  });

  it("shows the work moving once it is accepted and started", () => {
    render(
      <RequestStatusCard
        view={view({
          state: "accepted",
          decidedAt: "2026-11-26T10:00:00.000Z",
          taskStatus: "in_progress",
        })}
      />,
    );
    // Twice: the badge at the top and the step in the timeline.
    expect(screen.getAllByText("Accepted")).toHaveLength(2);
    expect(screen.getByText("Daniel started this.")).toBeInTheDocument();
    expect(screen.getByText("Not finished yet.")).toBeInTheDocument();
  });

  it("ends the timeline at the decline, with the reason", () => {
    render(<RequestStatusCard view={view({ state: "rejected", declineReason: "No capacity" })} />);
    expect(screen.getAllByText("Declined")).toHaveLength(2);
    expect(screen.getByText("Daniel declined: No capacity")).toBeInTheDocument();
    expect(screen.queryByText("In progress")).not.toBeInTheDocument();
  });

  it("says the work was cancelled rather than silently stalling", () => {
    render(<RequestStatusCard view={view({ state: "accepted", taskStatus: "cancelled" })} />);
    expect(screen.getByText("Daniel cancelled the work.")).toBeInTheDocument();
  });

  it("works when the owner has no display name", () => {
    render(<RequestStatusCard view={view({ ownerName: null })} />);
    expect(screen.getByText("The owner has not decided yet.")).toBeInTheDocument();
  });
});
