import { SHUTDOWN_TIMEOUT_MS } from "./config/constants.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { app } from "./app.js";
import { db } from "./db/knex.js";

const server = app.listen(env.PORT, () => {
  logger.info(
    `API listening on http://localhost:${env.PORT}${env.API_BASE_PATH} (${env.NODE_ENV})`,
  );
});

let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received: shutting down`);

  // Safety net: never hang forever on stuck connections.
  setTimeout(() => {
    logger.error("Shutdown timed out, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();

  server.close((closeError) => {
    db.destroy()
      .catch((error: unknown) => logger.error({ err: error }, "Error closing the database pool"))
      .finally(() => process.exit(closeError ? 1 : 0));
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
});
