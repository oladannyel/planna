import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ generateWeeklyReport: vi.fn() }));

vi.mock("../actions", () => ({ generateWeeklyReport: h.generateWeeklyReport }));

const { WeeklyReport } = await import("../WeeklyReport");

beforeEach(() => {
  h.generateWeeklyReport.mockReset();
});

describe("WeeklyReport", () => {
  it("shows an empty state when the week has no tasks", () => {
    render(<WeeklyReport weekStart="2026-06-15" hasTasks={false} initialNarrative={null} />);
    expect(screen.getByText("No activity this week")).toBeInTheDocument();
  });

  it("offers Generate when there is no report", () => {
    render(<WeeklyReport weekStart="2026-06-15" hasTasks initialNarrative={null} />);
    expect(screen.getByRole("button", { name: "Generate report" })).toBeInTheDocument();
  });

  it("shows an existing narrative with Regenerate", () => {
    render(<WeeklyReport weekStart="2026-06-15" hasTasks initialNarrative="Solid week." />);
    expect(screen.getByText("Solid week.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeInTheDocument();
  });

  it("generates and renders the new narrative", async () => {
    h.generateWeeklyReport.mockResolvedValue({
      ok: true,
      value: { narrative: "Fresh weekly.", stats: {} },
    });
    const user = userEvent.setup();
    render(<WeeklyReport weekStart="2026-06-15" hasTasks initialNarrative={null} />);

    await user.click(screen.getByRole("button", { name: "Generate report" }));
    await waitFor(() => {
      expect(screen.getByText("Fresh weekly.")).toBeInTheDocument();
    });
    expect(h.generateWeeklyReport).toHaveBeenCalledWith("2026-06-15");
  });

  it("surfaces an error when generation fails", async () => {
    h.generateWeeklyReport.mockResolvedValue({
      ok: false,
      error: { code: "AI_ERROR", message: "x" },
    });
    const user = userEvent.setup();
    render(<WeeklyReport weekStart="2026-06-15" hasTasks initialNarrative={null} />);

    await user.click(screen.getByRole("button", { name: "Generate report" }));
    await waitFor(() => {
      expect(screen.getByText(/Couldn't generate the report/)).toBeInTheDocument();
    });
  });
});
