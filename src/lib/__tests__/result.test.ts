import { describe, expect, it } from "vitest";

import type { AppError } from "../result";
import { err, isErr, isOk, ok } from "../result";

describe("result", () => {
  it("ok wraps a value with ok: true", () => {
    const result = ok(42);
    expect(result).toEqual({ ok: true, value: 42 });
  });

  it("err wraps an error with ok: false", () => {
    const error: AppError = { code: "NOT_FOUND", message: "missing" };
    const result = err(error);
    expect(result).toEqual({ ok: false, error });
  });

  it("isOk narrows to the Ok branch", () => {
    const result = ok("hello");
    expect(isOk(result)).toBe(true);
    expect(isErr(result)).toBe(false);
    if (isOk(result)) {
      expect(result.value).toBe("hello");
    }
  });

  it("isErr narrows to the Err branch", () => {
    const result = err<AppError>({ code: "UNAUTHORIZED", message: "no" });
    expect(isErr(result)).toBe(true);
    expect(isOk(result)).toBe(false);
    if (isErr(result)) {
      expect(result.error.code).toBe("UNAUTHORIZED");
    }
  });
});
