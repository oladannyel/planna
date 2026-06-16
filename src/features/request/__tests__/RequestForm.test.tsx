import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ submitRequest: vi.fn() }));

vi.mock("../actions", () => ({ submitRequest: h.submitRequest }));

const { RequestForm } = await import("../RequestForm");

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByLabelText("Your name"), "Ada");
  await user.type(screen.getByLabelText("Title"), "Fix bug");
  await user.type(screen.getByLabelText("Details"), "A sufficiently long description.");
}

beforeEach(() => {
  h.submitRequest.mockReset();
});

describe("RequestForm", () => {
  it("submits the form with the workspace slug and shows success", async () => {
    h.submitRequest.mockResolvedValue({ ok: true, value: { taskId: "t1" } });
    const user = userEvent.setup();
    render(<RequestForm slug="demo" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Submit request" }));

    await waitFor(() => {
      expect(screen.getByText("Request submitted")).toBeInTheDocument();
    });
    const payload = h.submitRequest.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.slug).toBe("demo");
    expect(payload.requesterName).toBe("Ada");
  });

  it("shows an invalid-link message for NOT_FOUND", async () => {
    h.submitRequest.mockResolvedValue({ ok: false, error: { code: "NOT_FOUND", message: "x" } });
    const user = userEvent.setup();
    render(<RequestForm slug="gone" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Submit request" }));

    await waitFor(() => {
      expect(screen.getByText(/no longer valid/)).toBeInTheDocument();
    });
  });

  it("includes a changed urgency in the payload", async () => {
    h.submitRequest.mockResolvedValue({ ok: true, value: { taskId: "t1" } });
    const user = userEvent.setup();
    render(<RequestForm slug="demo" />);

    await fillRequiredFields(user);
    await user.selectOptions(screen.getByLabelText("Urgency"), "urgent");
    await user.click(screen.getByRole("button", { name: "Submit request" }));

    await waitFor(() => screen.getByText("Request submitted"));
    const payload = h.submitRequest.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.urgency).toBe("urgent");
  });

  it("shows a generic message for non-NOT_FOUND errors", async () => {
    h.submitRequest.mockResolvedValue({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "x" },
    });
    const user = userEvent.setup();
    render(<RequestForm slug="demo" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Submit request" }));

    await waitFor(() => {
      expect(screen.getByText(/check the form and try again/)).toBeInTheDocument();
    });
  });

  it("lets the user submit another after success", async () => {
    h.submitRequest.mockResolvedValue({ ok: true, value: { taskId: "t1" } });
    const user = userEvent.setup();
    render(<RequestForm slug="demo" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Submit request" }));
    await waitFor(() => screen.getByText("Request submitted"));

    await user.click(screen.getByRole("button", { name: "Submit another request" }));
    expect(screen.getByRole("button", { name: "Submit request" })).toBeInTheDocument();
  });
});
