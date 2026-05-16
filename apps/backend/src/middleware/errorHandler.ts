import type { ErrorRequestHandler } from "express";

import { HttpError } from "../httpError.js";
import { getErrorContext, logError } from "../logger.js";
import { RateLimitError } from "../rateLimitError.js";

interface ErrorResponse {
  readonly error: string;
  readonly details?: string;
  readonly reason?: string;
  readonly retry_after?: number;
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const statusCode = getStatusCode(error);
  logHandledError(error, statusCode);
  response.status(statusCode).json({
    error: getErrorCode(error),
    ...getOptionalErrorFields(error),
    ...getRetryAfter(error),
  });
};

function getStatusCode(error: unknown): number {
  if (error instanceof HttpError) {
    return error.statusCode;
  }

  if (hasStatus(error)) {
    return error.status;
  }

  return 500;
}

function getErrorCode(error: unknown): string {
  if (error instanceof HttpError) {
    return error.code;
  }

  if (hasType(error) && error.type === "entity.too.large") {
    return "request_too_large";
  }

  if (error instanceof SyntaxError) {
    return "invalid_json";
  }

  return "internal_error";
}

function getDetails(error: unknown): string | undefined {
  if (error instanceof Error && error.message !== "") {
    return error.message;
  }

  return undefined;
}

function getOptionalErrorFields(error: unknown): Pick<ErrorResponse, "details" | "reason"> {
  return {
    ...getOptionalDetails(error),
    ...getOptionalReason(error),
  };
}

function getOptionalDetails(error: unknown): Pick<ErrorResponse, "details"> {
  const details = getDetails(error);
  return details === undefined ? {} : { details };
}

function getOptionalReason(error: unknown): Pick<ErrorResponse, "reason"> {
  return error instanceof HttpError && error.reason !== undefined ? { reason: error.reason } : {};
}

function getRetryAfter(error: unknown): Pick<ErrorResponse, "retry_after"> {
  if (error instanceof RateLimitError) {
    return { retry_after: error.retryAfterSeconds };
  }

  return {};
}

function hasStatus(error: unknown): error is { readonly status: number } {
  return typeof error === "object"
    && error !== null
    && "status" in error
    && typeof error.status === "number";
}

function hasType(error: unknown): error is { readonly type: string } {
  return typeof error === "object"
    && error !== null
    && "type" in error
    && typeof error.type === "string";
}

function logHandledError(error: unknown, statusCode: number): void {
  if (statusCode < 500) {
    return;
  }

  logError("request_failed", {
    status_code: statusCode,
    error_code: getErrorCode(error),
    ...getOptionalReason(error),
    ...getErrorContext(error),
  });
}
