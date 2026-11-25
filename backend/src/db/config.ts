import type { Knex } from "knex";
import { env } from "../config/env.js";

/** Shared by the app (db/knex.ts) and the Knex CLI (knexfile.ts). */
export const knexConfig: Knex.Config = {
  client: "mysql2",
  connection: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    timezone: env.DB_TIMEZONE,
    dateStrings: true, // DATE / TIME come back as plain "YYYY-MM-DD" / "HH:mm:ss" strings
    charset: "utf8mb4",
  },
  pool: { min: env.DB_POOL_MIN, max: env.DB_POOL_MAX },
  migrations: { directory: "./migrations", extension: "ts", loadExtensions: [".ts"] },
  seeds: { directory: "./seeds", extension: "ts" },
};
