import type { ApplicantProfile, RequisitionType, UserRole } from "../config/constants.js";

/** Acceptable email domains for SUST accounts (subdomains such as cse.sust.edu also count). */
export const SUST_EMAIL_DOMAINS: ReadonlyArray<string> = ["sust.edu", "student.sust.edu"];

/**
 * True for `local@sust.edu`, `local@student.sust.edu` and subdomains of those.
 * Hardened compared with the frontend port: exactly one `@` and a non-empty local part.
 */
export function isSustEmail(email: string): boolean {
  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2) return false;
  const [local = "", domain = ""] = parts;
  if (local.length === 0) return false;
  return SUST_EMAIL_DOMAINS.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`));
}

/**
 * Part 1 §11.3. A Department Head is their own recommender, and only Departmental/Official
 * requisitions by Students, Teachers or Officers need one. Always computed on the server from the
 * stored profile, never from a client-supplied flag.
 */
export function requiresRecommendation(
  profile: ApplicantProfile | null | undefined,
  requisitionType: RequisitionType,
  role?: UserRole,
): boolean {
  if (role === "DepartmentHead") return false;
  if (requisitionType !== "Departmental/Official") return false;
  return profile === "Student" || profile === "Teacher" || profile === "Officer";
}

/**
 * Where a submitted requisition goes next (Part 1 §11.3 and §11.4).
 * A requisition that already has a recommender (it was recommended, then sent back by the
 * Transport In-Charge) is not sent to the head again.
 */
export function resolveSubmissionStatus(input: {
  profile: ApplicantProfile | null | undefined;
  requisitionType: RequisitionType;
  role?: UserRole;
  hasRecommender?: boolean;
}): "Pending Recommendation" | "Pending on Transport Office" {
  if (input.hasRecommender) return "Pending on Transport Office";
  return requiresRecommendation(input.profile, input.requisitionType, input.role)
    ? "Pending Recommendation"
    : "Pending on Transport Office";
}

const normalizeScope = (value: string | null | undefined): string =>
  (value ?? "").trim().toLowerCase();

/** The requisition's `department` snapshot: the requester's department, or office for officers. */
export function snapshotDepartment(user: {
  department?: string | null;
  office?: string | null;
}): string | null {
  const department = (user.department ?? "").trim();
  if (department) return department;
  const office = (user.office ?? "").trim();
  return office || null;
}

/**
 * Part 1 §11.11: a Department Head's scope matches when `head_of_department` or `head_of_office`
 * equals the requisition's department (case-insensitive, trimmed). An empty department never matches.
 */
export function departmentScopeMatches(
  requisitionDepartment: string | null | undefined,
  head: { headOfDepartment?: string | null; headOfOffice?: string | null },
): boolean {
  const target = normalizeScope(requisitionDepartment);
  if (!target) return false;
  return (
    normalizeScope(head.headOfDepartment) === target || normalizeScope(head.headOfOffice) === target
  );
}
