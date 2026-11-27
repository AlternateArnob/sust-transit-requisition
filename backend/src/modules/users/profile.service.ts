import { v4 as uuid } from "uuid";
import { env } from "../../config/env.js";
import { withTransaction } from "../../db/transaction.js";
import { AppError, unauthenticated, validation, type ErrorDetail } from "../../errors/AppError.js";
import {
  AFFILIATION_FIELDS,
  needsApplicantProfile,
  pickAffiliation,
  type AffiliationField,
} from "../../domain/onboarding.js";
import {
  deleteStoredFile,
  detectFileType,
  sanitizeOriginalName,
  writeStoredFile,
} from "../../services/fileStorage.js";
import {
  checkPasswordPolicy,
  hashPassword,
  assertPasswordPolicy,
  verifyPassword,
} from "../../services/password.js";
import { revokeAllForUser } from "../../services/tokens.js";
import { resolveUnitName } from "../directory/directory.service.js";
import { deleteFileRow, findFileById, insertFile } from "../files/file.repository.js";
import { signatureUrlFor } from "./user.mapper.js";
import {
  findUserById,
  setPasswordHash,
  setSignatureFileId,
  updateProfileColumns,
  type UserRecord,
} from "./user.repository.js";
import type { ChangePasswordBody, UpdateProfileBody } from "./profile.schemas.js";

// Own-profile use cases (Part 1 §12.3): complete or update the profile, upload the signature and
// change the password. Each one runs in a single transaction with the user row locked, so two
// parallel submissions cannot interleave.

const notVerified = () =>
  new AppError(403, "ACCOUNT_NOT_VERIFIED", "Verify your email to continue.");

const REQUIRED_MESSAGE: Record<AffiliationField, string> = {
  department: "Department is required.",
  office: "Office is required.",
  designation: "Designation is required.",
  studentRegNumber: "Registration number is required.",
};

/** Fields only profile-holding roles (Applicant, DepartmentHead) may set. */
const APPLICANT_ONLY_FIELDS = [
  "applicantProfile",
  "department",
  "office",
  "designation",
  "studentRegNumber",
] as const;

const given = (value: string | undefined): boolean => value !== undefined && value.trim() !== "";

/** Omitted keeps the stored value; anything sent (even blank) replaces it. */
const pick = (provided: string | undefined, stored: string | null): string | null =>
  provided !== undefined ? provided : stored;

/**
 * `PUT /me/profile`. Applicants and Department Heads fill in the full applicant profile (their
 * `headOfDepartment` / `headOfOffice` scope is never editable here); Transport Office and Super
 * Admin accounts may only change name and mobile. A password may be set here only while the
 * account has none (first-time completion); afterwards `PUT /me/password` is the only way.
 */
export async function updateProfile(userId: string, input: UpdateProfileBody): Promise<UserRecord> {
  // The slow hash is computed before the transaction so the user row is not locked meanwhile.
  const newPassword = input.password ? input.password : undefined;
  const passwordProblem = newPassword ? checkPasswordPolicy(newPassword) : null;
  const passwordHash = newPassword && !passwordProblem ? await hashPassword(newPassword) : null;

  return withTransaction(async (trx) => {
    const user = await findUserById(userId, trx, { forUpdate: true });
    if (!user) throw unauthenticated("Account no longer exists");
    if (!user.isVerified) throw notVerified();

    const errors: ErrorDetail[] = [];

    // --- password: required once, then only through /me/password -----------------------------
    if (user.passwordHash === null) {
      if (!newPassword) errors.push({ path: "password", message: "Password is required." });
      else if (passwordProblem) errors.push({ path: "password", message: passwordProblem });
    } else if (newPassword) {
      errors.push({
        path: "password",
        message:
          "To change your password, use the change-password form (it asks for your current password).",
      });
    }

    let affiliation: Record<AffiliationField, string | null> | null = null;
    let applicantProfile: UserRecord["applicantProfile"] = null;

    if (needsApplicantProfile(user.role)) {
      applicantProfile = input.applicantProfile ?? user.applicantProfile;
      if (!applicantProfile) {
        errors.push({ path: "applicantProfile", message: "Select your applicant type." });
      } else {
        affiliation = pickAffiliation(applicantProfile, {
          department: pick(input.department, user.department),
          office: pick(input.office, user.office),
          designation: pick(input.designation, user.designation),
          studentRegNumber: pick(input.studentRegNumber, user.studentRegNumber),
        });
        for (const field of AFFILIATION_FIELDS[applicantProfile]) {
          if (!affiliation[field]) errors.push({ path: field, message: REQUIRED_MESSAGE[field] });
        }
        // Names must match the directory: recommendation routing compares them as exact strings.
        if (affiliation.department) {
          const name = await resolveUnitName("Department", affiliation.department, trx);
          if (name) affiliation.department = name;
          else errors.push({ path: "department", message: "Select a department from the list." });
        }
        if (affiliation.office) {
          const name = await resolveUnitName("Office", affiliation.office, trx);
          if (name) affiliation.office = name;
          else errors.push({ path: "office", message: "Select an office from the list." });
        }
      }
      if (user.signatureFileId === null) {
        errors.push({ path: "signature", message: "Signature is required." });
      }
    } else {
      for (const field of APPLICANT_ONLY_FIELDS) {
        if (given(input[field])) {
          errors.push({ path: field, message: "This field cannot be changed for your role." });
        }
      }
    }

    if (errors.length > 0) throw validation(errors);

    await updateProfileColumns(
      user.id,
      {
        fullName: input.fullName,
        mobile: input.mobile,
        ...(affiliation && applicantProfile ? { applicantProfile, ...affiliation } : {}),
        ...(passwordHash ? { passwordHash } : {}),
      },
      trx,
    );
    const updated = await findUserById(user.id, trx);
    if (!updated) throw new Error("User row vanished during a profile update");
    return updated;
  });
}

export interface SignatureUpload {
  buffer: Buffer;
  /** Name the browser gave the file; stored for display only. */
  originalName?: string;
}

/**
 * `POST /me/signature`. Checks the bytes (PNG or JPEG, within the size limit), stores them under
 * a random name, points the user at the new file and removes the previous one. The old file on
 * disk is deleted only after the database commit, the new one is removed again if it fails.
 */
export async function replaceSignature(
  userId: string,
  upload: SignatureUpload,
): Promise<{ hasSignature: true; signatureUrl: string }> {
  if (upload.buffer.length > env.MAX_SIGNATURE_BYTES) {
    throw new AppError(413, "PAYLOAD_TOO_LARGE", "The signature image is too large.", {
      maxBytes: env.MAX_SIGNATURE_BYTES,
    });
  }
  const detected = detectFileType(upload.buffer);
  if (!detected || detected.kind === "pdf") {
    throw validation([{ path: "file", message: "The signature must be a PNG or JPEG image." }]);
  }

  const written = await writeStoredFile(upload.buffer, detected);
  const fileId = uuid();
  const replaced: { storageName?: string } = {};

  try {
    await withTransaction(async (trx) => {
      const user = await findUserById(userId, trx, { forUpdate: true });
      if (!user) throw unauthenticated("Account no longer exists");
      if (!user.isVerified) throw notVerified();

      await insertFile(
        {
          id: fileId,
          owner_user_id: user.id,
          purpose: "signature",
          original_name: sanitizeOriginalName(upload.originalName, `signature.${detected.ext}`),
          mime_type: detected.mime,
          size_bytes: written.sizeBytes,
          storage_name: written.storageName,
          sha256: written.sha256,
        },
        trx,
      );
      // Point the user at the new file first: deleting the old row first would trigger the
      // foreign key's ON DELETE SET NULL on `users.signature_file_id`.
      await setSignatureFileId(user.id, fileId, trx);
      if (user.signatureFileId) {
        const old = await findFileById(user.signatureFileId, trx);
        if (old) {
          replaced.storageName = old.storage_name;
          await deleteFileRow(old.id, trx);
        }
      }
    });
  } catch (error) {
    await deleteStoredFile(written.storageName);
    throw error;
  }

  if (replaced.storageName) await deleteStoredFile(replaced.storageName);
  return { hasSignature: true, signatureUrl: signatureUrlFor(fileId) };
}

/**
 * `PUT /me/password`. Needs the current password. All refresh tokens are revoked, so other
 * devices (and an attacker holding a stolen cookie) are signed out; the access token in use
 * keeps working until it expires, at most `JWT_ACCESS_TTL`.
 */
export async function changePassword(userId: string, input: ChangePasswordBody): Promise<void> {
  assertPasswordPolicy(input.newPassword, "newPassword");

  await withTransaction(async (trx) => {
    const user = await findUserById(userId, trx, { forUpdate: true });
    if (!user) throw unauthenticated("Account no longer exists");

    if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
      throw validation([{ path: "currentPassword", message: "Current password is incorrect." }]);
    }
    if (input.newPassword === input.currentPassword) {
      throw validation([
        {
          path: "newPassword",
          message: "New password must be different from the current password.",
        },
      ]);
    }

    await setPasswordHash(user.id, await hashPassword(input.newPassword), trx);
    await revokeAllForUser(user.id, { trx });
  });
}
