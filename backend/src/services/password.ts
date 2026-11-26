import argon2, { type HashOptions } from "argon2";
import { env } from "../config/env.js";
import { validation } from "../errors/AppError.js";

// argon2id (Part 1 §8.1). The production parameters follow the OWASP minimum for argon2id
// (19 MiB, 2 passes). Tests use the cheapest valid parameters so the suite stays fast.
const HASH_OPTIONS: HashOptions & { raw?: false } =
  env.NODE_ENV === "test"
    ? { type: argon2.argon2id, memoryCost: 8, timeCost: 1, parallelism: 1 }
    : { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

/** Upper bound so a huge body cannot be used to burn CPU in the hash function. */
export const PASSWORD_MAX_LENGTH = 128;

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, HASH_OPTIONS);
}

/** False for a wrong password, a missing hash or a malformed hash; never throws. */
export async function verifyPassword(
  hash: string | null | undefined,
  plain: string,
): Promise<boolean> {
  if (!hash) return false;
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * Verifies against a throw-away hash. Login calls this when the email is unknown so that unknown
 * emails and wrong passwords take about the same time (Part 1 §8.5: do not reveal which one).
 */
export async function burnPasswordCheck(plain: string): Promise<void> {
  dummyHash ??= hashPassword("not-a-real-password");
  await verifyPassword(await dummyHash, plain);
}

/** Throws a 422 for a password that breaks the policy; `path` names the offending field. */
export function assertPasswordPolicy(password: string, path = "password"): void {
  const min = env.PASSWORD_MIN_LENGTH;
  if (password.length < min) {
    throw validation([{ path, message: `Password must be at least ${min} characters` }]);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    throw validation([
      { path, message: `Password must be at most ${PASSWORD_MAX_LENGTH} characters` },
    ]);
  }
}
