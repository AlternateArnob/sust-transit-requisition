import type { Knex } from "knex";
import { db } from "./knex.js";

export type Trx = Knex.Transaction;

/**
 * Runs `fn` in one database transaction: commits when it resolves, rolls back when it throws
 * (the error is re-thrown). Services own the transaction; repositories/helpers receive `trx`.
 */
export function withTransaction<T>(fn: (trx: Trx) => Promise<T>): Promise<T> {
  return db.transaction(fn);
}
