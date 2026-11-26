import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  acceptRequest: vi.fn(),
  rejectRequest: vi.fn(),
  refresh: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("../actions", () => ({
  acceptRequest: h.acceptRequest,
  rejectRequest: h.rejectRequest,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));
vi.mock("@/components/ui", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useToast: () => ({ toast: h.toast }) };
});

const { RequestInbox } = await import("../RequestInbox");
import type { InboxItem } from "../RequestInbox";

function item(overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    id: "req-1",
    workspaceId: "ws-1",
    requesterName: "Ada",
    requesterEmail: "ada@example.com",
    title: "Fix the export bug",
    description: "CSV export drops the last row.",
    urgency: "high",
    desiredDeadline: null,
    state: "pending",
    decidedAt: null,
    declineReason: null,
    taskId: null,
    token: "a".repeat(32),
    createdAt: "2026-11-26T09:00:00.000Z",
    updatedAt: "2026-11-26T09:00:00.000Z",
    taskStatus: null,
    ...overrides,
  };
}

beforeEach(() => {
  h.acceptRequest.mockReset().mockResolvedValue({ ok: true, value: { taskId: "task-1" } });
  h.rejectRequest.mockReset().mockResolvedValue({ ok: true, value: { requestId: "req-1" } });
  h.refresh.mockReset();
  h.toast.mockReset();
});

describe("RequestInbox", () => {
  it("says what to do when there is nothing to decide", () => {
    render(<RequestInbox items={[]} />);
    expect(screen.getByText("No requests yet")).toBeInTheDocument();
  });

  it("shows who asked, what for, and how urgent", () => {
    render(<RequestInbox items={[item()]} />);
    expect(screen.getByText("Fix the export bug")).toBeInTheDocument();
    expect(screen.getByText(/Ada/)).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Waiting on you")).toBeInTheDocument();
  });

  it("accepts a request and refreshes the page", async () => {
    const user = userEvent.setup();
    render(<RequestInbox items={[item()]} />);

    await user.click(screen.getByRole("button", { name: "Accept" }));

    expect(h.acceptRequest).toHaveBeenCalledWith("req-1");
    await waitFor(() => expect(h.refresh).toHaveBeenCalled());
  });

  /**
   * Declining is the message the requester reads, so it asks for a reason
   * before it fires rather than sending a bare refusal on one click.
   */
  it("asks for a reason before declining", async () => {
    const user = userEvent.setup();
    render(<RequestInbox items={[item()]} />);

    await user.click(screen.getByRole("button", { name: "Decline" }));
    expect(h.rejectRequest).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/Reason/), "No capacity");
    await user.click(screen.getByRole("button", { name: "Decline request" }));

    expect(h.rejectRequest).toHaveBeenCalledWith("req-1", "No capacity");
  });

  it("reports a failure instead of pretending it worked", async () => {
    const user = userEvent.setup();
    h.acceptRequest.mockResolvedValue({
      ok: false,
      error: { code: "DB_ERROR", message: "insert boom" },
    });
    render(<RequestInbox items={[item()]} />);

    await user.click(screen.getByRole("button", { name: "Accept" }));

    await waitFor(() =>
      expect(h.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Could not accept", tone: "error" }),
      ),
    );
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it("offers no decision on a request that already has one", () => {
    render(
      <RequestInbox
        items={[item({ state: "accepted", taskId: "task-1", taskStatus: "in_progress" })]}
      />,
    );

    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
  });

  it("shows the reason it sent on a declined request", () => {
    render(<RequestInbox items={[item({ state: "rejected", declineReason: "No capacity" })]} />);
    expect(screen.getByText(/Reason sent: No capacity/)).toBeInTheDocument();
  });
});
