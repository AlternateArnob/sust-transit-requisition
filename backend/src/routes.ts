import { Router } from "express";
import { healthRouter } from "./modules/health/health.routes.js";

/** Mounted at env.API_BASE_PATH by app.ts. Later steps register their module routers here. */
export const apiRouter = Router();

apiRouter.use(healthRouter);
