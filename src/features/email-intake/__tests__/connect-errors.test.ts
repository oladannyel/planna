import { describe, expect, it } from "vitest";

import { CONNECT_ERRORS, connectErrorMessage } from "../connect-errors";

describe("connectErrorMessage", () => {
  it("has a message for every code the callback can send back", () => {
    for (const code of Object.keys(CONNECT_ERRORS)) {
      expect(connectErrorMessage(code)).toBe(CONNECT_ERRORS[code]);
    }
  });

  it("names the missing key, rather than saying 'failed'", () => {
    expect(connectErrorMessage("key_missing")).toContain("EMAIL_TOKEN_KEY");
  });

  it("falls back for a code it does not know", () => {
    expect(connectErrorMessage("something_new")).toBe("Connecting the mailbox failed.");
  });

  it("shows nothing when the flow did not fail", () => {
    expect(connectErrorMessage(undefined)).toBeNull();
  });
});
