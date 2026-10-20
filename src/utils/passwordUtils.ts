/**
 * Lightweight, dependency-free password hashing for this prototype.
 *
 * There is no backend here — everything lives in localStorage, the same
 * way OTP codes are already shown directly in the UI for dev/testing
 * purposes. This hash exists only so raw passwords aren't sitting in
 * localStorage in plain text; it is NOT cryptographically secure and
 * must be replaced with a real backend + bcrypt/argon2 (or similar)
 * before this app ever handles real user data.
 */

const SALT = "sust-transit::";

export const MIN_PASSWORD_LENGTH = 6;

export function hashPassword(password: string): string {
  const input = `${SALT}${password}`;

  let hash1 = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash1 = (hash1 << 5) - hash1 + input.charCodeAt(i);
    hash1 |= 0; // force 32-bit int
  }

  let hash2 = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash2 = (hash2 * 33) ^ input.charCodeAt(i);
  }

  return `${(hash1 >>> 0).toString(16)}${(hash2 >>> 0).toString(16)}`;
}

export function verifyPassword(
  password: string,
  passwordHash: string | undefined,
): boolean {
  if (!passwordHash) return false;
  return hashPassword(password) === passwordHash;
}
