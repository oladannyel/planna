import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  signInWithOtp: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithOAuth: h.signInWithOAuth, signInWithOtp: h.signInWithOtp },
  }),
}));

const { default: LoginPage } = await import("../page");

beforeEach(() => {
  h.signInWithOAuth.mockReset().mockResolvedValue({ error: null });
  h.signInWithOtp.mockReset().mockResolvedValue({ error: null });
  window.history.replaceState(null, "", "/login");
});

describe("LoginPage", () => {
  it("offers Google as well as the email link", () => {
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: /Continue with Google/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Send magic link/ })).toBeVisible();
  });

  it("sends Google back to the same callback the magic link uses", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole("button", { name: /Continue with Google/ }));

    expect(h.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  });

  it("explains an unconfigured provider instead of quoting the SDK", async () => {
    h.signInWithOAuth.mockResolvedValue({
      error: { message: "Unsupported provider: provider is not enabled" },
    });
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole("button", { name: /Continue with Google/ }));

    expect(await screen.findByText(/Google sign-in is not enabled/)).toBeVisible();
  });

  it("reports an expired link carried in the URL fragment", async () => {
    window.history.replaceState(
      null,
      "",
      "/login?error=missing_code#error=access_denied&error_code=otp_expired",
    );
    render(<LoginPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/expired or was already used/);
  });

  it("translates the email rate limit on the magic-link path", async () => {
    h.signInWithOtp.mockResolvedValue({ error: { message: "email rate limit exceeded" } });
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.click(screen.getByRole("button", { name: /Send magic link/ }));

    expect(await screen.findByText(/Too many sign-in emails/)).toBeVisible();
  });
});
