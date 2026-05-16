import type { RequestHandler } from "express";

import { HttpError } from "../httpError.js";

export const notFoundHandler: RequestHandler = () => {
  throw new HttpError(404, "not_found", "Route not found.");
};
