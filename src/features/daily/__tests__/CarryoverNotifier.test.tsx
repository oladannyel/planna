import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ toast: vi.fn() }));

vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: h.toast }) }));

const { CarryoverNotifier } = await import("../CarryoverNotifier");

beforeEach(() => {
  h.toast.mockReset();
  sessionStorage.clear();
});

afterEach(() => {
  sessionStorage.clear();
});

describe("CarryoverNotifier", () => {
  it("fires a warning toast once when carryovers exist", async () => {
    render(<CarryoverNotifier count={3} />);
    await waitFor(() => expect(h.toast).toHaveBeenCalledTimes(1));
    const arg = h.toast.mock.calls[0]?.[0] as { description: string; tone: string };
    expect(arg.tone).toBe("warning");
    expect(arg.description).toContain("3 tasks carried over");
  });

  it("uses singular wording for one carryover", async () => {
    render(<CarryoverNotifier count={1} />);
    await waitFor(() => expect(h.toast).toHaveBeenCalled());
    const arg = h.toast.mock.calls[0]?.[0] as { description: string };
    expect(arg.description).toContain("1 task carried over");
  });

  it("does not fire when there are no carryovers", () => {
    render(<CarryoverNotifier count={0} />);
    expect(h.toast).not.toHaveBeenCalled();
  });

  it("does not fire again once notified this session", async () => {
    const first = render(<CarryoverNotifier count={2} />);
    await waitFor(() => expect(h.toast).toHaveBeenCalledTimes(1));
    first.unmount();

    render(<CarryoverNotifier count={2} />);
    // sessionStorage guard prevents a second fire.
    await new Promise((r) => setTimeout(r, 20));
    expect(h.toast).toHaveBeenCalledTimes(1);
  });
});
