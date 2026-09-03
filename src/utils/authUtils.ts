import type {
  ApplicantProfile,
  RequisitionType,
  UserAccount,
  UserRole,
} from "../types";

/**
 * Acceptable email domains for SUST accounts. Centralised so the rule is
 * easy to update if a new domain is added (e.g. faculty.sust.edu).
 */
export const SUST_EMAIL_DOMAINS: ReadonlyArray<string> = [
  "sust.edu",
  "student.sust.edu",
];

export function isSustEmail(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.includes("@")) {
    return false;
  }
  const [, domain = ""] = trimmed.split("@");
  return SUST_EMAIL_DOMAINS.some(
    (allowed) => domain === allowed || domain.endsWith(`.${allowed}`),
  );
}

/**
 * Per spec §5: a Department/Office Head recommendation is only required
 * for official use by Students, Teachers, and Officers. Personal and
 * Departmental use never go through a recommender.
 */
export function requiresRecommendation(
  profile: ApplicantProfile | undefined,
  requisitionType: RequisitionType,
): boolean {
  if (requisitionType !== "Official") {
    return false;
  }
  return profile === "Student" || profile === "Teacher" || profile === "Officer";
}

/**
 * Profile-locked fields per spec. Editing these after registration
 * requires admin action.
 */
export function requiresProfileFields(
  profile: ApplicantProfile,
): ReadonlyArray<keyof UserAccount> {
  switch (profile) {
    case "Student":
      return ["department", "studentRegNumber"];
    case "Teacher":
      return ["department", "designation"];
    case "Officer":
      return ["office", "designation"];
    default:
      return [];
  }
}

export function isAdminRole(role: UserRole): boolean {
  return role === "Admin";
}

export function isDepartmentHeadRole(role: UserRole): boolean {
  return role === "DepartmentHead";
}
