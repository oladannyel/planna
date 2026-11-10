import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ShareRequestLink } from "../ShareRequestLink";

const URL_UNDER_TEST = "https://planna-puce.vercel.app/request/daniel-a1b2";

/**
 * Install the clipboard stub *after* `userEvent.setup()`.
 *
 * user-event installs its own `navigator.clipboard` as part of setup, so a
 * stub written before it is silently replaced — and the test then exercises
 * user-event's clipboard instead of the component's error path, which passes
 * for the wrong reason.
 */
function setup(writeText: () => Promise<void> = () => Promise.resolve()) {
  const user = userEvent.setup();
  const spy = vi.fn(writeText);
  Object.defineProperty(navigator, "clipboard", { value: { writeText: spy }, configurable: true });
  return { user, writeText: spy };
}

describe("ShareRequestLink", () => {
  it("keeps the link hidden until it is asked for", () => {
    render(<ShareRequestLink url={URL_UNDER_TEST} />);
    expect(screen.getByRole("button", { name: "Share link" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("reveals the link, in full, for reading", async () => {
    const { user } = setup();
    render(<ShareRequestLink url={URL_UNDER_TEST} />);

    await user.click(screen.getByRole("button", { name: "Share link" }));

    // Visible and selectable, not only copyable — the clipboard is not
    // available everywhere and its failure is silent.
    expect(screen.getByLabelText("Your request link")).toHaveValue(URL_UNDER_TEST);
    expect(screen.getByRole("button", { name: "Share link" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("says the link needs no account, because that is the question people ask", async () => {
    const { user } = setup();
    render(<ShareRequestLink url={URL_UNDER_TEST} />);

    await user.click(screen.getByRole("button", { name: "Share link" }));

    expect(screen.getByText(/do not need an account/i)).toBeInTheDocument();
  });

  it("copies the link and confirms it", async () => {
    const { user, writeText } = setup();
    render(<ShareRequestLink url={URL_UNDER_TEST} />);

    await user.click(screen.getByRole("button", { name: "Share link" }));
    await user.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    });
    expect(writeText).toHaveBeenCalledWith(URL_UNDER_TEST);
  });

  it("announces the copy rather than relying on the icon changing", async () => {
    const { user } = setup();
    render(<ShareRequestLink url={URL_UNDER_TEST} />);

    await user.click(screen.getByRole("button", { name: "Share link" }));
    await user.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Link copied to clipboard");
    });
  });

  it("selects the text when the clipboard refuses, so the copy is still possible", async () => {
    const { user } = setup(() => Promise.reject(new Error("Write permission denied")));
    render(<ShareRequestLink url={URL_UNDER_TEST} />);

    await user.click(screen.getByRole("button", { name: "Share link" }));
    await user.click(screen.getByRole("button", { name: "Copy" }));

    const field = screen.getByLabelText<HTMLInputElement>("Your request link");
    await waitFor(() => {
      expect(field).toHaveFocus();
    });
    expect(field.selectionStart).toBe(0);
    expect(field.selectionEnd).toBe(URL_UNDER_TEST.length);
    expect(screen.queryByRole("button", { name: "Copied" })).not.toBeInTheDocument();
  });

  it("closes again on a second press", async () => {
    const { user } = setup();
    render(<ShareRequestLink url={URL_UNDER_TEST} />);

    const toggle = screen.getByRole("button", { name: "Share link" });
    await user.click(toggle);
    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("does not let the link be edited into something else", async () => {
    const { user } = setup();
    render(<ShareRequestLink url={URL_UNDER_TEST} />);

    await user.click(screen.getByRole("button", { name: "Share link" }));
    const field = screen.getByLabelText("Your request link");
    await user.type(field, "junk");

    expect(field).toHaveValue(URL_UNDER_TEST);
  });
});
