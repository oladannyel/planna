/* eslint-disable no-console -- this module is the single sanctioned console boundary */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

interface LogRecord {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
}

/** What a redacted value is replaced with, so the shape stays readable. */
const REDACTED = "[redacted]";

/**
 * Keys whose values never belong in a log line, matched case-insensitively on
 * any substring.
 *
 * SECURITY.md promises that the service-role key "must never reach a log
 * line". Before this, nothing enforced that promise: the logger serialised
 * whatever object it was handed, and the objects it gets handed are upstream
 * errors — the kind that like to carry the request that failed, headers
 * included. The promise was true only for as long as nobody passed the wrong
 * thing. Now it is true because of the code.
 */
const SENSITIVE_KEY_PATTERNS = [
  "key",
  "secret",
  "token",
  "password",
  "authorization",
  "auth",
  "cookie",
  "credential",
  "session",
  "bearer",
];

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Secret-shaped strings, redacted wherever they appear — including inside a
 * value whose key looked innocent, which is how a key in a URL or an
 * `Authorization` header echoed into a message gets out.
 */
const SECRET_VALUE_PATTERNS: RegExp[] = [
  // Bearer tokens in a message or a stringified header block.
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  // OpenAI / OpenRouter style keys.
  /\bsk-[A-Za-z0-9_-]{16,}/g,
  // JWTs, which is what every Supabase key is.
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  // Postgres connection strings with an inline password.
  /\b(postgres(?:ql)?:\/\/[^:\s]+):[^@\s]+@/gi,
];

function scrubString(value: string): string {
  return SECRET_VALUE_PATTERNS.reduce(
    (acc, pattern) =>
      acc.replace(pattern, (match, prefix: string | undefined) =>
        prefix ? `${prefix}:${REDACTED}@` : REDACTED,
      ),
    value,
  );
}

/**
 * Recursively redact a log context.
 *
 * Depth-limited and cycle-safe: an upstream error can hold a reference back to
 * the client that produced it, and a logger that recursed into that would hang
 * the request it was trying to report on.
 */
function scrub(value: unknown, seen: WeakSet<object>, depth = 0): unknown {
  if (depth > 6) return "[truncated]";
  if (typeof value === "string") return scrubString(value);
  if (value === null || typeof value !== "object") return value;

  if (seen.has(value)) return "[circular]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => scrub(item, seen, depth + 1));
  }

  // Errors do not serialise through JSON.stringify — an un-special-cased Error
  // logs as `{}`, which is how a logged failure becomes a mystery.
  if (value instanceof Error) {
    return {
      name: value.name,
      message: scrubString(value.message),
      ...(value.stack ? { stack: scrubString(value.stack) } : {}),
    };
  }

  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    out[key] = isSensitiveKey(key) ? REDACTED : scrub(inner, seen, depth + 1);
  }
  return out;
}

export function redact(context: LogContext): LogContext {
  return scrub(context, new WeakSet()) as LogContext;
}

function emit(level: LogLevel, message: string, context?: LogContext): void {
  const record: LogRecord = {
    level,
    message: scrubString(message),
    timestamp: new Date().toISOString(),
    ...(context ? { context: redact(context) } : {}),
  };

  const serialized = JSON.stringify(record);

  switch (level) {
    case "error":
      console.error(serialized);
      return;
    case "warn":
      console.warn(serialized);
      return;
    default:
      console.log(serialized);
      return;
  }
}

/**
 * Structured JSON logger. Use everywhere instead of `console.*`
 * (the `no-console` ESLint rule is enabled project-wide).
 *
 * Every message and context object passes through `redact` first. That is a
 * backstop, not a licence: do not pass a secret to the logger on the
 * assumption that it will be caught.
 */
export const logger = {
  debug: (message: string, context?: LogContext): void => emit("debug", message, context),
  info: (message: string, context?: LogContext): void => emit("info", message, context),
  warn: (message: string, context?: LogContext): void => emit("warn", message, context),
  error: (message: string, context?: LogContext): void => emit("error", message, context),
};
