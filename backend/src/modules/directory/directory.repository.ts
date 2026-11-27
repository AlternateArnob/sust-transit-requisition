import type { DirectoryKind } from "../../config/constants.js";
import { db } from "../../db/knex.js";
import type { DbExecutor } from "../../db/transaction.js";

/** A row of `directory_units` (Part 1 §10.2). */
interface DirectoryUnitRow {
  id: number;
  kind: DirectoryKind;
  name: string;
  school: string | null;
  is_active: number;
}

/** Names of the active units of one kind, in alphabetical order. */
export async function listActiveNames(
  kind: DirectoryKind,
  executor: DbExecutor = db,
): Promise<string[]> {
  const rows = await executor<DirectoryUnitRow>("directory_units")
    .where({ kind, is_active: 1 })
    .orderBy("name")
    .select("name");
  return rows.map((row) => row.name);
}

/**
 * The stored spelling of an active unit, or `null` when no such unit exists. Matching uses the
 * column's case-insensitive collation, but callers store the returned name, because routing
 * compares department names as exact strings (Part 1 §10.3, §11.11).
 */
export async function findActiveUnitName(
  kind: DirectoryKind,
  name: string,
  executor: DbExecutor = db,
): Promise<string | null> {
  const row = await executor<DirectoryUnitRow>("directory_units")
    .where({ kind, name: name.trim(), is_active: 1 })
    .first("name");
  return row?.name ?? null;
}
