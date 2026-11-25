import "dotenv/config";
import type { Knex } from "knex";

// Minimal connection config so `npm run migrate` / `seed` work from Step 0.
// Step 1 replaces the raw process.env reads with the validated `env` object.
const config: Knex.Config = {
  client: "mysql2",
  connection: {
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "sust_transit",
    password: process.env.DB_PASSWORD ?? "change-me",
    database: process.env.DB_NAME ?? "sust_transit",
    timezone: process.env.DB_TIMEZONE ?? "Z",
    dateStrings: true,
  },
  pool: {
    min: Number(process.env.DB_POOL_MIN ?? 2),
    max: Number(process.env.DB_POOL_MAX ?? 10),
  },
  migrations: { directory: "./migrations", extension: "ts" },
  seeds: { directory: "./seeds", extension: "ts" },
};

export default config;
