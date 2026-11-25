import { Router } from "express";
import { health, version } from "./health.controller.js";

export const healthRouter = Router();

healthRouter.get("/health", health);
healthRouter.get("/version", version);
