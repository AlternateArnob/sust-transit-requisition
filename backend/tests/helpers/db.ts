import { db } from "../../src/db/knex.js";

export { db };

const TEST_DATABASE = "sust_transit_test";

/**
 * Empties every table except Knex's own bookkeeping tables. Foreign-key checks are switched off
 * on a single pinned connection (the setting is per session) and always switched back on.
 */
export async function truncateAll(): Promise<void> {
  const [row] = (await db.raw("SELECT DATABASE() AS name"))[0] as { name: string }[];
  if (row?.name !== TEST_DATABASE) {
    throw new Error(
      `truncateAll() refuses to run against "${row?.name}" (expected ${TEST_DATABASE})`,
    );
  }

  const [tables] = (await db.raw(
    `SELECT table_name AS name FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' AND table_name NOT LIKE 'knex\\_%'`,
  )) as [{ name: string }[], unknown];

  await db.transaction(async (trx) => {
    await trx.raw("SET FOREIGN_KEY_CHECKS = 0");
    try {
      for (const { name } of tables) {
        await trx.raw("TRUNCATE TABLE ??", [name]);
      }
    } finally {
      await trx.raw("SET FOREIGN_KEY_CHECKS = 1");
    }
  });
}

/** Names of all application tables (Knex bookkeeping tables excluded), sorted. */
export async function listAppTables(): Promise<string[]> {
  const [rows] = (await db.raw(
    `SELECT table_name AS name FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' AND table_name NOT LIKE 'knex\\_%'
      ORDER BY table_name`,
  )) as [{ name: string }[], unknown];
  return rows.map((row) => row.name);
}
