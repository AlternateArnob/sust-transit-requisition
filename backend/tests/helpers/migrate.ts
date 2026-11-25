import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const backendRoot = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Runs the Knex CLI exactly like `npm run migrate` does. Migrations are TypeScript files, which
 * Vitest's module runner cannot hand to Knex, so a child process with the tsx loader is used.
 */
export function runKnex(...args: string[]): string {
  return execFileSync(
    process.execPath,
    ["--import", "tsx", "node_modules/knex/bin/cli.js", ...args],
    { cwd: backendRoot, env: process.env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
}

export const migrateLatest = () => runKnex("migrate:latest");
export const migrateRollbackAll = () => runKnex("migrate:rollback", "--all");
