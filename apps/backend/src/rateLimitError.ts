import { HttpError } from "./httpError.js";

export class RateLimitError extends HttpError {
  public constructor(public readonly retryAfterSeconds: number) {
    super(429, "rate_limit_exceeded");
  }
}
