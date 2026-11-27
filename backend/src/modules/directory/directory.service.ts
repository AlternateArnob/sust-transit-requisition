import type { DirectoryKind } from "../../config/constants.js";
import type { DbExecutor } from "../../db/transaction.js";
import { db } from "../../db/knex.js";
import * as repository from "./directory.repository.js";

export const listDepartments = (): Promise<string[]> => repository.listActiveNames("Department");

export const listOffices = (): Promise<string[]> => repository.listActiveNames("Office");

/**
 * Returns the canonical name of a department or office, or `null` when the directory has no such
 * active unit. Used wherever a user-supplied name must match the directory (profile, head scope).
 */
export function resolveUnitName(
  kind: DirectoryKind,
  name: string,
  executor: DbExecutor = db,
): Promise<string | null> {
  return repository.findActiveUnitName(kind, name, executor);
}
