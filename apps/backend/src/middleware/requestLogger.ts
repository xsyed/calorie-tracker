import { type RequestHandler } from "express";

import { type LogValue, logInfo } from "../logger.js";

const LOGGED_METHODS = new Set(["GET", "POST"]);

export const requestLogger: RequestHandler = (request, response, next) => {
  if (!LOGGED_METHODS.has(request.method)) {
    next();
    return;
  }

  const startTime = Date.now();
  const responseJson = response.json.bind(response);
  let responseBody: unknown;

  response.json = (body: unknown) => {
    responseBody = body;
    return responseJson(body);
  };

  response.on("finish", () => {
    logInfo("http_request_completed", {
      method: request.method,
      path: request.originalUrl,
      status_code: response.statusCode,
      duration_ms: Date.now() - startTime,
      request_payload: getRequestPayload(request.body),
      request_query: normalizeObject(request.query),
      response_body: normalizeObject(responseBody),
    });
  });

  next();
};

function getRequestPayload(body: unknown): LogValue {
  if (body === undefined) {
    return null;
  }

  return normalizeObject(body);
}

function normalizeObject(value: unknown): LogValue {
  if (value === undefined) {
    return null;
  }

  if (value === null || isLogPrimitive(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(normalizeObject);
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, normalizeObject(item)]),
  );
}

function isLogPrimitive(value: unknown): value is boolean | number | string {
  return typeof value === "boolean" || typeof value === "number" || typeof value === "string";
}
