import { Router } from "express";

import { type BackendConfig } from "../config.js";
import { createFirebaseAuthVerifier } from "../firebaseAuth.js";
import { requireFirebaseAuth } from "../middleware/auth.js";
import { validateParseRequest } from "../middleware/parseRequestValidator.js";
import { createParseRateLimiter } from "../middleware/rateLimiter.js";
import { createOpenRouterClient } from "../openRouterClient.js";

export function createApiRouter(config: BackendConfig): Router {
  const router = Router();
  const authVerifier = createFirebaseAuthVerifier(config);
  const parseRateLimiter = createParseRateLimiter(config);
  const openRouterClient = createOpenRouterClient(config);

  router.post(
    "/parse",
    parseRateLimiter.limitFlood,
    validateParseRequest,
    requireFirebaseAuth(authVerifier),
    parseRateLimiter.limitAuthenticatedUser,
    async (request, response, next) => {
      try {
        const prompt = request.parseRequest?.prompt;

        if (prompt === undefined) {
          throw new Error("Validated parse request is missing.");
        }

        response.json(await openRouterClient.parseNutrition(prompt));
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
