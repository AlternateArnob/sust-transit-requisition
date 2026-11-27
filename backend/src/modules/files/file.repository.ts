import type { FilePurpose } from "../../config/constants.js";
import { db } from "../../db/knex.js";
import type { DbExecutor } from "../../db/transaction.js";

/** A row of the `files` table (Part 1 §10.2). */
export interface FileRow {
  id: string;
  owner_user_id: string;
  purpose: FilePurpose;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  storage_name: string;
  sha256: string;
  created_at: string;
}

export type NewFile = Omit<FileRow, "created_at">;

export async function insertFile(file: NewFile, executor: DbExecutor = db): Promise<void> {
  await executor("files").insert(file);
}

export async function findFileById(id: string, executor: DbExecutor = db): Promise<FileRow | null> {
  const row = await executor<FileRow>("files").where({ id }).first();
  return row ?? null;
}

export async function deleteFileRow(id: string, executor: DbExecutor = db): Promise<void> {
  await executor("files").where({ id }).delete();
}
