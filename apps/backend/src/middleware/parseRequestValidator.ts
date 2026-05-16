import { type RequestHandler } from "express";

import { HttpError } from "../httpError.js";

const MAX_PROMPT_LENGTH = 1_000;

interface ParseRequestBody {
  readonly prompt: unknown;
  readonly device_id: unknown;
}

export const validateParseRequest: RequestHandler = (request, _response, next) => {
  const body = request.body as Partial<ParseRequestBody>;
  const prompt = validatePrompt(body.prompt);
  const deviceId = validateDeviceId(body.device_id);

  if (!isValid(prompt) || !isValid(deviceId)) {
    next(new HttpError(400, "invalid_request", getErrorDetails(prompt, deviceId)));
    return;
  }

  request.parseRequest = {
    prompt: prompt.value,
    deviceId: deviceId.value,
  };
  next();
};

type ValidationResult = {
  readonly value: string;
  readonly error?: never;
} | {
  readonly value?: never;
  readonly error: string;
};

function validatePrompt(value: unknown): ValidationResult {
  if (typeof value !== "string") {
    return { error: "prompt must be a string." };
  }

  const prompt = value.trim();

  if (prompt.length < 1 || prompt.length > MAX_PROMPT_LENGTH) {
    return { error: "prompt must be 1-1000 characters." };
  }

  return { value: prompt };
}

function validateDeviceId(value: unknown): ValidationResult {
  if (typeof value !== "string") {
    return { error: "device_id must be a string." };
  }

  const deviceId = value.trim();

  if (deviceId === "") {
    return { error: "device_id must be non-empty." };
  }

  return { value: deviceId };
}

function isValid(result: ValidationResult): result is { readonly value: string } {
  return result.error === undefined;
}

function getErrorDetails(...results: readonly ValidationResult[]): string {
  return results
    .map((result) => result.error)
    .filter((error): error is string => error !== undefined)
    .join(" ");
}
