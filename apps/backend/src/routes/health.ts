import { Router } from "express";

import { type FirebaseAdminHealth } from "../firebaseAuth.js";

export function createHealthRouter(firebaseAdminHealth: FirebaseAdminHealth): Router {
  const router = Router();

  router.get("/health", (_request, response) => {
    if (!firebaseAdminHealth.isReady()) {
      response.status(503).json({
        status: "error",
        uptime: process.uptime(),
        details: "firebase_admin_init_failed",
      });
      return;
    }

    response.json({
      status: "ok",
      uptime: process.uptime(),
    });
  });

  return router;
}
