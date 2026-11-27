import { DB_HEALTH_TIMEOUT_MS } from "../../config/constants.js";
import { APP_NAME, APP_VERSION } from "../../config/version.js";
import { db } from "../../db/knex.js";

export interface HealthResult {
  status: "ok" | "error";
  db: "up" | "down";
  time: string;
}

async function pingDatabase(): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error("Database health check timed out")),
      DB_HEALTH_TIMEOUT_MS,
    );
  });
  try {
    await Promise.race([db.raw("SELECT 1"), timeout]);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkHealth(): Promise<HealthResult> {
  const up = await pingDatabase();
  return { status: up ? "ok" : "error", db: up ? "up" : "down", time: new Date().toISOString() };
}

export function getVersion() {
  return { name: APP_NAME, version: APP_VERSION };
}
