import { mkdirSync, rmSync } from "node:fs";
import "./testEnv.js";
import { migrateLatest } from "./helpers/migrate.js";

/** Runs once per test run, before any test file: brings the test database up to date. */
export default function globalSetup(): () => void {
  const uploadDir = process.env.UPLOAD_DIR as string;
  rmSync(uploadDir, { recursive: true, force: true });
  mkdirSync(uploadDir, { recursive: true });

  try {
    migrateLatest();
  } catch (error) {
    // Don't take down pure unit tests when MySQL is not running; database tests fail loudly instead.
    console.warn(
      "\n[tests] Could not migrate sust_transit_test - database tests will fail.\n" +
        "        Start MySQL (docker compose up -d) and check DB_* in .env.\n" +
        `        ${String((error as Error).message).split("\n")[0]}\n`,
    );
  }

  return () => rmSync(uploadDir, { recursive: true, force: true });
}
