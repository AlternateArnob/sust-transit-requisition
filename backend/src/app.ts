import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import hpp from "hpp";
import { pinoHttp } from "pino-http";
import { REQUEST_BODY_LIMIT } from "./config/constants.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFoundHandler } from "./middleware/notFound.js";
import { createGlobalRateLimiter } from "./middleware/rateLimit.js";
import { requestId } from "./middleware/requestId.js";
import { apiRouter } from "./routes.js";

/** Builds the Express app. It never calls listen() so tests can import it (see server.ts). */
export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  // One proxy hop when behind a reverse proxy. `true` would trust a spoofable X-Forwarded-For chain.
  app.set("trust proxy", env.TRUST_PROXY ? 1 : false);

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id,
      customLogLevel: (_req, res, err) =>
        err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
    }),
  );
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
  app.use(cookieParser());
  app.use(hpp());
  app.use(createGlobalRateLimiter());

  app.use(env.API_BASE_PATH, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export const app = createApp();
