import { createHash } from "node:crypto";

export type LogValue = boolean | number | string | null | undefined | LogObject | LogValue[];

interface LogObject {
  readonly [key: string]: LogValue;
}

type LogContext = LogObject;

const SENSITIVE_KEY_PATTERN = /authorization|bearer|token|api[_-]?key|service[_-]?account|private[_-]?key|secret/i;
const MAX_LOG_VALUE_LENGTH = 240;
const TOKEN_HASH_LENGTH = 12;

export function logWarn(message: string, context: LogContext = {}): void {
  writeLog("warn", message, context);
}

export function logInfo(message: string, context: LogContext = {}): void {
  writeLog("info", message, context);
}

export function logError(message: string, context: LogContext = {}): void {
  writeLog("error", message, context);
}

export function createTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, TOKEN_HASH_LENGTH);
}

export function getErrorContext(error: unknown): LogContext {
  if (!(error instanceof Error)) {
    return {
      error_type: typeof error,
    };
  }

  return {
    error_name: error.name,
    error_message: error.message,
    ...getErrorCodeContext(error),
  };
}

function writeLog(level: string, message: string, context: LogContext): void {
  const payload = {
    level,
    message,
    ...sanitizeContext(context),
  };
  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}

function sanitizeContext(context: LogContext): LogContext {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key, sanitizeValue(key, value)]),
  );
}

function sanitizeValue(key: string, value: LogValue): LogValue {
  if (value === undefined || value === null) {
    return value;
  }

  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return "[redacted]";
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(key, item));
  }

  if (typeof value === "object") {
    return sanitizeContext(value);
  }

  if (typeof value !== "string" || value.length <= MAX_LOG_VALUE_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_LOG_VALUE_LENGTH)}...`;
}

function getErrorCodeContext(error: Error): LogContext {
  if ("code" in error && typeof error.code === "string") {
    return { error_code: error.code };
  }

  return {};
}
