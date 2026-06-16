/* eslint-disable no-console -- this module is the single sanctioned console boundary */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

interface LogRecord {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
}

function emit(level: LogLevel, message: string, context?: LogContext): void {
  const record: LogRecord = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ? { context } : {}),
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
 */
export const logger = {
  debug: (message: string, context?: LogContext): void => emit("debug", message, context),
  info: (message: string, context?: LogContext): void => emit("info", message, context),
  warn: (message: string, context?: LogContext): void => emit("warn", message, context),
  error: (message: string, context?: LogContext): void => emit("error", message, context),
};
