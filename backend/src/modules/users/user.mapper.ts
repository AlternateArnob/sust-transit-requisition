import type { ApplicantProfile, UserRole } from "../../config/constants.js";
import { env } from "../../config/env.js";
import { toIso } from "../../db/time.js";
import { getNextStep, type OnboardingStep } from "../../domain/onboarding.js";
import type { UserRecord } from "./user.repository.js";

/**
 * The user as the API returns it (Part 1 §12.1 `PublicUser`). It never carries the password hash,
 * login counters or the internal signature file id. Empty optional fields are left out of the JSON.
 */
export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
  applicantProfile?: ApplicantProfile;
  fullName?: string;
  mobile?: string;
  studentRegNumber?: string;
  department?: string;
  office?: string;
  designation?: string;
  headOfDepartment?: string;
  headOfOffice?: string;
  hasSignature: boolean;
  signatureUrl?: string;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface MeResponse extends PublicUser {
  /** Present only while onboarding is incomplete. */
  nextStep?: OnboardingStep;
}

/** Built once and used by every endpoint that returns a user. */
export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    ...(user.applicantProfile ? { applicantProfile: user.applicantProfile } : {}),
    ...(user.fullName ? { fullName: user.fullName } : {}),
    ...(user.mobile ? { mobile: user.mobile } : {}),
    ...(user.studentRegNumber ? { studentRegNumber: user.studentRegNumber } : {}),
    ...(user.department ? { department: user.department } : {}),
    ...(user.office ? { office: user.office } : {}),
    ...(user.designation ? { designation: user.designation } : {}),
    ...(user.headOfDepartment ? { headOfDepartment: user.headOfDepartment } : {}),
    ...(user.headOfOffice ? { headOfOffice: user.headOfOffice } : {}),
    hasSignature: user.signatureFileId !== null,
    ...(user.signatureFileId
      ? { signatureUrl: `${env.API_BASE_PATH}/files/${user.signatureFileId}` }
      : {}),
    isVerified: user.isVerified,
    isActive: user.isActive,
    createdAt: toIso(user.createdAt) ?? user.createdAt,
  };
}

/** What `onboarding.ts` needs to know about a stored user. */
export function getUserNextStep(user: UserRecord): OnboardingStep | null {
  return getNextStep({
    role: user.role,
    isVerified: user.isVerified,
    hasPassword: user.passwordHash !== null,
    hasSignature: user.signatureFileId !== null,
    applicantProfile: user.applicantProfile,
    fullName: user.fullName,
    mobile: user.mobile,
    department: user.department,
    office: user.office,
    designation: user.designation,
    studentRegNumber: user.studentRegNumber,
  });
}

/** `GET /auth/me`: the public user plus `nextStep` when onboarding is not finished. */
export function toMeResponse(user: UserRecord): MeResponse {
  const nextStep = getUserNextStep(user);
  return { ...toPublicUser(user), ...(nextStep ? { nextStep } : {}) };
}
