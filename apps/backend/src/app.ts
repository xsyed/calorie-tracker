import express, { json } from "express";

import { type BackendConfig } from "./config.js";
import { createFirebaseAdminHealth } from "./firebaseAuth.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFoundHandler } from "./middleware/notFoundHandler.js";
import { createApiRouter } from "./routes/api.js";
import { createHealthRouter } from "./routes/health.js";

const REQUEST_BODY_LIMIT = "32kb";

export function createApp(config: BackendConfig): express.Express {
  const app = express();
  const firebaseAdminHealth = createFirebaseAdminHealth(config);

  app.use(json({ limit: REQUEST_BODY_LIMIT }));
  app.use(createHealthRouter(firebaseAdminHealth));
  app.use("/api", createApiRouter(config));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
