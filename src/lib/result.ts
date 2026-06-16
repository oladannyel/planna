export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E = AppError> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export type AppError =
  | { code: "DB_ERROR"; message: string; cause?: unknown }
  | { code: "AI_ERROR"; message: string; cause?: unknown }
  | { code: "VALIDATION_ERROR"; message: string; fields?: Record<string, string[]> }
  | { code: "NOT_FOUND"; message: string }
  | { code: "UNAUTHORIZED"; message: string }
  | { code: "RATE_LIMIT"; message: string };

/** Narrowing helpers — avoid hand-checking the discriminant at call sites. */
export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result.ok;
export const isErr = <T, E>(result: Result<T, E>): result is Err<E> => !result.ok;
