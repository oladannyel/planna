import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ generateMonthlySummary: vi.fn() }));

vi.mock("../actions", () => ({ generateMonthlySummary: h.generateMonthlySummary }));

const { MonthlySummary } = await import("../MonthlySummary");

beforeEach(() => {
  h.generateMonthlySummary.mockReset();
});

describe("MonthlySummary", () => {
  it("shows an empty state when the month has no tasks", () => {
    render(<MonthlySummary year={2026} month={6} hasTasks={false} initialNarrative={null} />);
    expect(screen.getByText("Nothing to summarize")).toBeInTheDocument();
  });

  it("offers Generate when there is no summary yet", () => {
    render(<MonthlySummary year={2026} month={6} hasTasks initialNarrative={null} />);
    expect(screen.getByRole("button", { name: "Generate summary" })).toBeInTheDocument();
  });

  it("shows an existing narrative with a Regenerate control", () => {
    render(
      <MonthlySummary year={2026} month={6} hasTasks initialNarrative="Last month was solid." />,
    );
    expect(screen.getByText("Last month was solid.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeInTheDocument();
  });

  it("generates and renders the new narrative", async () => {
    h.generateMonthlySummary.mockResolvedValue({
      ok: true,
      value: { narrative: "Fresh narrative.", stats: {} },
    });
    const user = userEvent.setup();
    render(<MonthlySummary year={2026} month={6} hasTasks initialNarrative={null} />);

    await user.click(screen.getByRole("button", { name: "Generate summary" }));
    await waitFor(() => {
      expect(screen.getByText("Fresh narrative.")).toBeInTheDocument();
    });
    expect(h.generateMonthlySummary).toHaveBeenCalledWith(2026, 6);
  });

  it("surfaces an error when generation fails", async () => {
    h.generateMonthlySummary.mockResolvedValue({
      ok: false,
      error: { code: "AI_ERROR", message: "x" },
    });
    const user = userEvent.setup();
    render(<MonthlySummary year={2026} month={6} hasTasks initialNarrative={null} />);

    await user.click(screen.getByRole("button", { name: "Generate summary" }));
    await waitFor(() => {
      expect(screen.getByText(/Couldn't generate the summary/)).toBeInTheDocument();
    });
  });
});
