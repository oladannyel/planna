import { describe, expect, it } from "vitest";

import { describeSignInError, readAuthError } from "../auth-error";

describe("readAuthError", () => {
  it("says nothing on an ordinary visit", () => {
    expect(readAuthError("", "")).toBeNull();
    expect(readAuthError("?next=/board", "")).toBeNull();
  });

  it("prefers Supabase's reason in the hash over our guess in the query", () => {
    // The exact URL a user lands on when a link has expired.
    const message = readAuthError(
      "?error=missing_code",
      "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    );
    expect(message).toMatch(/expired or was already used/);
    expect(message).not.toMatch(/did not carry a login code/);
  });

  it("falls back to the generic hash error when there is no specific code", () => {
    expect(readAuthError("", "#error=access_denied")).toMatch(/no longer valid/);
  });

  it("uses our callback's reason when the hash is empty", () => {
    expect(readAuthError("?error=missing_code", "")).toMatch(/did not carry a login code/);
    expect(readAuthError("?error=exchange_failed", "")).toMatch(/same browser/);
  });

  it("surfaces an unmapped code's description rather than staying silent", () => {
    expect(
      readAuthError("", "#error_code=some_new_code&error_description=Totally+new+problem"),
    ).toBe("Totally new problem");
  });

  it("falls back to a generic message when even the description is missing", () => {
    expect(readAuthError("", "#error_code=some_new_code")).toMatch(/Something went wrong/);
  });

  it("tolerates the separators being present or absent", () => {
    expect(readAuthError("error=missing_code", "")).toMatch(/did not carry a login code/);
  });
});

describe("describeSignInError", () => {
  it("explains Supabase's bare rate-limit string", () => {
    // Exactly what the built-in email service returns once the hourly cap is hit.
    expect(describeSignInError("email rate limit exceeded")).toMatch(
      /Too many sign-in emails .* Wait a few minutes/,
    );
  });

  it("catches the other wordings of the same cap", () => {
    expect(describeSignInError("For security purposes, too many requests")).toMatch(/Too many/);
  });

  it("explains a rejected address", () => {
    expect(describeSignInError("Unable to validate email address: invalid format")).toMatch(
      /valid email address/,
    );
  });

  it("passes an unrecognised message through rather than inventing one", () => {
    expect(describeSignInError("Something specific from the provider")).toBe(
      "Something specific from the provider",
    );
  });
});
