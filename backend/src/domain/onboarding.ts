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

  switch (user.applicantProfile) {
    case "Student":
      if (blank(user.department)) missing.push("department");
      if (blank(user.studentRegNumber)) missing.push("studentRegNumber");
      break;
    case "Teacher":
      if (blank(user.department)) missing.push("department");
      if (blank(user.designation)) missing.push("designation");
      break;
    case "Officer":
      if (blank(user.office)) missing.push("office");
      if (blank(user.designation)) missing.push("designation");
      break;
    default:
      missing.push("applicantProfile");
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
