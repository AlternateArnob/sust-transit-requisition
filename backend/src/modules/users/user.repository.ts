import { v4 as uuid } from "uuid";
import type { ApplicantProfile, UserRole } from "../../config/constants.js";
import { db } from "../../db/knex.js";
import type { DbExecutor } from "../../db/transaction.js";

/** A row of the `users` table exactly as MySQL returns it (Part 1 §10.2). */
export interface UserRow {
  id: string;
  email: string;
  role: UserRole;
  applicant_profile: ApplicantProfile | null;
  full_name: string | null;
  mobile: string | null;
  password_hash: string | null;
  signature_file_id: string | null;
  student_reg_number: string | null;
  department: string | null;
  office: string | null;
  designation: string | null;
  head_of_department: string | null;
  head_of_office: string | null;
  is_verified: number;
  is_active: number;
  failed_login_count: number;
  locked_until: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

/** The camelCase, boolean-typed view of a user that services work with. */
export interface UserRecord {
  id: string;
  email: string;
  role: UserRole;
  applicantProfile: ApplicantProfile | null;
  fullName: string | null;
  mobile: string | null;
  passwordHash: string | null;
  signatureFileId: string | null;
  studentRegNumber: string | null;
  department: string | null;
  office: string | null;
  designation: string | null;
  headOfDepartment: string | null;
  headOfOffice: string | null;
  isVerified: boolean;
  isActive: boolean;
  failedLoginCount: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toUserRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    applicantProfile: row.applicant_profile,
    fullName: row.full_name,
    mobile: row.mobile,
    passwordHash: row.password_hash,
    signatureFileId: row.signature_file_id,
    studentRegNumber: row.student_reg_number,
    department: row.department,
    office: row.office,
    designation: row.designation,
    headOfDepartment: row.head_of_department,
    headOfOffice: row.head_of_office,
    isVerified: row.is_verified === 1,
    isActive: row.is_active === 1,
    failedLoginCount: row.failed_login_count,
    lockedUntil: row.locked_until,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Emails are stored lower-case and trimmed (Part 1 §10.2). */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

interface FindOptions {
  /** `SELECT ... FOR UPDATE`; only meaningful inside a transaction. */
  forUpdate?: boolean;
}

export async function findUserById(
  id: string,
  executor: DbExecutor = db,
  options: FindOptions = {},
): Promise<UserRecord | null> {
  const query = executor<UserRow>("users").where({ id }).first();
  if (options.forUpdate) query.forUpdate();
  const row = await query;
  return row ? toUserRecord(row) : null;
}

export async function findUserByEmail(
  email: string,
  executor: DbExecutor = db,
  options: FindOptions = {},
): Promise<UserRecord | null> {
  const query = executor<UserRow>("users")
    .where({ email: normalizeEmail(email) })
    .first();
  if (options.forUpdate) query.forUpdate();
  const row = await query;
  return row ? toUserRecord(row) : null;
}

const isDuplicateKey = (error: unknown): boolean =>
  (error as { code?: string } | null)?.code === "ER_DUP_ENTRY";

/**
 * Creates the unverified Applicant row for a new registration (Part 1 §8.3 step 1). Returns the
 * existing row instead when another request registered the same email a moment earlier.
 */
export async function createUnverifiedApplicant(
  email: string,
  executor: DbExecutor = db,
): Promise<UserRecord> {
  try {
    await executor("users").insert({
      id: uuid(),
      email: normalizeEmail(email),
      role: "Applicant",
      is_verified: 0,
      is_active: 1,
    });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
  }
  const user = await findUserByEmail(email, executor);
  if (!user) throw new Error("User row vanished right after insert");
  return user;
}

/** OTP proven: the email now belongs to this account. */
export async function markEmailVerified(id: string, executor: DbExecutor = db): Promise<void> {
  await executor("users").where({ id }).update({ is_verified: 1 });
}

/**
 * Counts one wrong password. On the `maxAttempts`-th consecutive failure the account is locked
 * until `lockUntil` and the counter starts again from zero, so the next lock needs a full set of
 * new failures. The row is locked so parallel guesses cannot all read the same count.
 */
export async function recordFailedLogin(
  id: string,
  options: { maxAttempts: number; lockUntil: Date },
): Promise<{ locked: boolean }> {
  return db.transaction(async (trx) => {
    const row = await trx<UserRow>("users").where({ id }).forUpdate().first();
    if (!row) return { locked: false };

    const failures = row.failed_login_count + 1;
    if (failures >= options.maxAttempts) {
      await trx("users")
        .where({ id })
        .update({ failed_login_count: 0, locked_until: options.lockUntil });
      return { locked: true };
    }
    await trx("users").where({ id }).update({ failed_login_count: failures });
    return { locked: false };
  });
}

/** Successful login: clears the failure counter and any expired lock, stamps `last_login_at`. */
export async function recordSuccessfulLogin(
  id: string,
  now: Date,
  executor: DbExecutor = db,
): Promise<void> {
  await executor("users")
    .where({ id })
    .update({ failed_login_count: 0, locked_until: null, last_login_at: now });
}
