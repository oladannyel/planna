import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ markRead: vi.fn(), refresh: vi.fn() }));

vi.mock("../actions", () => ({ markNotificationsRead: h.markRead }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));

const { NotificationBell } = await import("../NotificationBell");
import type { BellNotification } from "../queries";

function note(overrides: Partial<BellNotification> = {}): BellNotification {
  return {
    id: "n1",
    kind: "request_received",
    title: "New request from Ada",
    body: "Fix the export bug",
    requestId: "req-1",
    readAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  h.markRead.mockReset().mockResolvedValue({ ok: true, value: { updated: 1 } });
  h.refresh.mockReset();
});

describe("NotificationBell", () => {
  it("says how many are unread, for a screen reader too", () => {
    render(<NotificationBell items={[note()]} unread={3} />);
    expect(screen.getByRole("button", { name: "Notifications, 3 unread" })).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows no badge when everything has been seen", () => {
    render(<NotificationBell items={[note({ readAt: "2026-11-26T09:00:00.000Z" })]} unread={0} />);
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
  });

  it("caps the badge rather than widening the button", () => {
    render(<NotificationBell items={[note()]} unread={42} />);
    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it("lists the items and links each to the inbox", async () => {
    const user = userEvent.setup();
    render(<NotificationBell items={[note()]} unread={1} />);

    await user.click(screen.getByRole("button", { name: /Notifications/ }));

    expect(screen.getByText("New request from Ada")).toBeInTheDocument();
    expect(screen.getAllByRole("link").at(-1)).toHaveAttribute("href", "/requests");
  });

  /** Once the list is on screen, "have I seen this" is answered. */
  it("marks everything read on open and clears the badge at once", async () => {
    const user = userEvent.setup();
    render(<NotificationBell items={[note()]} unread={2} />);

    await user.click(screen.getByRole("button", { name: /Notifications/ }));

    expect(screen.queryByText("2")).not.toBeInTheDocument();
    await waitFor(() => expect(h.markRead).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(h.refresh).toHaveBeenCalled());
  });

  it("does not call the server when there is nothing unread", async () => {
    const user = userEvent.setup();
    render(<NotificationBell items={[note({ readAt: "x" })]} unread={0} />);

    await user.click(screen.getByRole("button", { name: "Notifications" }));

    expect(h.markRead).not.toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<NotificationBell items={[note()]} unread={0} />);

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("closes when the click lands outside it", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <p data-testid="elsewhere">elsewhere</p>
        <NotificationBell items={[note()]} unread={0} />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.click(screen.getByTestId("elsewhere"));
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  /**
   * The badge is a local copy so it can drop the instant the menu opens. The
   * server remains the source of truth: a navigation that brings a new count
   * must win over that copy.
   */
  it("takes a new count from the server after it has been cleared locally", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<NotificationBell items={[note()]} unread={1} />);

    await user.click(screen.getByRole("button", { name: /Notifications/ }));
    expect(screen.queryByText("1")).not.toBeInTheDocument();

    rerender(<NotificationBell items={[note(), note({ id: "n2" })]} unread={2} />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("writes each item's age in the reader's terms", async () => {
    const user = userEvent.setup();
    const now = Date.now();
    render(
      <NotificationBell
        items={[
          note({ id: "a", createdAt: new Date(now - 10_000).toISOString() }),
          note({ id: "b", createdAt: new Date(now - 20 * 60_000).toISOString() }),
          note({ id: "c", createdAt: new Date(now - 5 * 3_600_000).toISOString() }),
          note({ id: "d", createdAt: new Date(now - 9 * 86_400_000).toISOString() }),
        ]}
        unread={0}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Notifications" }));

    expect(screen.getByText("just now")).toBeInTheDocument();
    expect(screen.getByText("20m ago")).toBeInTheDocument();
    expect(screen.getByText("5h ago")).toBeInTheDocument();
    // Older than a day falls back to a date, which has no "ago" in it.
    expect(screen.queryByText(/\d+h ago/)).toBeInTheDocument();
  });

  it("shows an item with no body", async () => {
    const user = userEvent.setup();
    render(<NotificationBell items={[note({ body: null })]} unread={0} />);

    await user.click(screen.getByRole("button", { name: "Notifications" }));

    expect(screen.getByText("New request from Ada")).toBeInTheDocument();
  });

  it("says so when there is nothing to show", async () => {
    const user = userEvent.setup();
    render(<NotificationBell items={[]} unread={0} />);

    await user.click(screen.getByRole("button", { name: "Notifications" }));

    expect(screen.getByText("Nothing yet.")).toBeInTheDocument();
  });
});
