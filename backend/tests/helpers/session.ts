import { randomUUID } from "node:crypto";
import type { UserRole } from "../../src/config/constants.js";
import { hashPassword } from "../../src/services/password.js";
import { signAccessToken, type TokenScope } from "../../src/services/tokens.js";
import { seed as seedDirectoryUnits } from "../../seeds/01_directory_units.js";
import { db } from "./db.js";
import { createUser } from "./factories.js";

export const PASSWORD = "correct-horse-battery";

/** Fills `directory_units` exactly like `npm run seed` does. */
export const seedDirectory = (): Promise<void> => seedDirectoryUnits(db);

/** `Authorization` header for a user, as the login or OTP step would have issued it. */
export function bearer(
  user: Record<string, unknown>,
  scope: TokenScope = "full",
): Record<string, string> {
  const { token } = signAccessToken({
    sub: String(user.id),
    role: (user.role ?? "Applicant") as UserRole,
    scope,
  });
  return { Authorization: `Bearer ${token}` };
}

type Row = Record<string, unknown>;

/** A verified account that has no password yet, i.e. what OTP verification leaves behind. */
export const createFreshApplicant = (overrides: Row = {}): Promise<Row> =>
  createUser({ is_verified: 1, ...overrides });

/** A verified account with a password but no profile. */
export async function createUserWithPassword(overrides: Row = {}): Promise<Row> {
  return createUser({
    is_verified: 1,
    password_hash: await hashPassword(PASSWORD),
    ...overrides,
  });
}

/** Inserts a `files` row (and nothing on disk) for a user; handy for access-control tests. */
export async function createFileRow(ownerId: unknown, overrides: Row = {}): Promise<Row> {
  const id = randomUUID();
  const row = {
    id,
    owner_user_id: ownerId,
    purpose: "signature",
    original_name: "signature.png",
    mime_type: "image/png",
    size_bytes: 100,
    storage_name: `${id}.png`,
    sha256: "a".repeat(64),
    ...overrides,
  };
  await db("files").insert(row);
  return row;
}
