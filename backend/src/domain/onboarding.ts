import type { ApplicantProfile, UserRole } from "../config/constants.js";

// Part 1 §8.3 / §12.3: what an account still needs before it can be used. Pure, so `/auth/me`,
// the profile endpoint and requisition submission (409 PROFILE_INCOMPLETE) share one definition.

/** The part of a user the onboarding rules look at. */
export interface OnboardingSubject {
  role: UserRole;
  isVerified: boolean;
  hasPassword: boolean;
  hasSignature: boolean;
  applicantProfile: ApplicantProfile | null;
  fullName: string | null;
  mobile: string | null;
  department: string | null;
  office: string | null;
  designation: string | null;
  studentRegNumber: string | null;
}

export type OnboardingStep = "otp" | "profile-setup";

/** Roles that apply for vehicles themselves and so need a full applicant profile. */
const PROFILE_ROLES: readonly UserRole[] = ["Applicant", "DepartmentHead"];

const blank = (value: string | null | undefined): boolean => !value || value.trim() === "";

export const needsApplicantProfile = (role: UserRole): boolean => PROFILE_ROLES.includes(role);

/** The profile fields that describe where an applicant belongs (Part 1 §12.3). */
export type AffiliationField = "department" | "office" | "designation" | "studentRegNumber";

/**
 * Which affiliation fields each applicant type uses. Student: department + registration number;
 * Teacher: department + designation; Officer: office + designation. Every other field is not
 * part of that profile and is stored empty, so a stale value can never leak into a requisition's
 * `department ?? office` snapshot (an Officer's old department would otherwise win over the office).
 */
export const AFFILIATION_FIELDS: Readonly<Record<ApplicantProfile, readonly AffiliationField[]>> = {
  Student: ["department", "studentRegNumber"],
  Teacher: ["department", "designation"],
  Officer: ["office", "designation"],
};

const ALL_AFFILIATION_FIELDS: readonly AffiliationField[] = [
  "department",
  "office",
  "designation",
  "studentRegNumber",
];

/**
 * The four affiliation fields as they should be stored for `profile`: the ones that profile uses
 * keep their (trimmed) value, the rest become `null`. Blank values become `null` too.
 */
export function pickAffiliation(
  profile: ApplicantProfile,
  values: Partial<Record<AffiliationField, string | null>>,
): Record<AffiliationField, string | null> {
  const used = AFFILIATION_FIELDS[profile];
  const result = {} as Record<AffiliationField, string | null>;
  for (const field of ALL_AFFILIATION_FIELDS) {
    const value = used.includes(field) ? values[field]?.trim() : undefined;
    result[field] = value ? value : null;
  }
  return result;
}

/**
 * Names (camelCase, as in the API) of the profile fields that are still empty. Student needs a
 * department and registration number, Teacher a department and designation, Officer an office and
 * designation (Part 1 §12.3). Transport Office and Super Admin accounts need nothing here.
 */
export function missingProfileFields(user: OnboardingSubject): string[] {
  if (!needsApplicantProfile(user.role)) return [];

  const missing: string[] = [];
  if (blank(user.fullName)) missing.push("fullName");
  if (blank(user.mobile)) missing.push("mobile");
  if (!user.hasSignature) missing.push("signature");

  if (!user.applicantProfile) {
    missing.push("applicantProfile");
    return missing;
  }
  for (const field of AFFILIATION_FIELDS[user.applicantProfile]) {
    if (blank(user[field])) missing.push(field);
  }
  return missing;
}

/** True when the account has a verified email, a password and (where needed) a full profile. */
export function isOnboardingComplete(user: OnboardingSubject): boolean {
  return getNextStep(user) === null;
}

/**
 * `"otp"` while the email is unverified, `"profile-setup"` while the password or profile is
 * missing, `null` when the account is ready to use.
 */
export function getNextStep(user: OnboardingSubject): OnboardingStep | null {
  if (!user.isVerified) return "otp";
  if (!user.hasPassword) return "profile-setup";
  if (missingProfileFields(user).length > 0) return "profile-setup";
  return null;
}
