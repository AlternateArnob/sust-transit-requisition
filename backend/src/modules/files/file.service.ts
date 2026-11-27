import type { AuthUser } from "../../middleware/auth.js";
import { notFound } from "../../errors/AppError.js";
import { findFileById, type FileRow } from "./file.repository.js";

/**
 * The file a user may download, or a 404. Basic rule for now: only the owner (Part 2 Step 6).
 * Step 21 extends it to the scoped Department Head and the Transport Office roles (Part 1 §12.17).
 * A file that exists but may not be read gets the same 404 as one that does not exist.
 */
export async function getReadableFile(fileId: string, user: AuthUser): Promise<FileRow> {
  const file = await findFileById(fileId);
  if (!file || file.owner_user_id !== user.id) throw notFound("File not found");
  return file;
}
