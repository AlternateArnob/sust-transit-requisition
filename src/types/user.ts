/**
 * Phase 0 (admin module): the flat "Admin" role has been split into the
 * three distinct Transport Office roles the FRD calls for, each with its
 * own permissions — see utils/permissions.ts for the capability matrix.
 *
 * "Applicant" and "DepartmentHead" are intentionally left untouched here:
 * they belong to the applicant-registration and recommender modules
 * respectively, which are owned elsewhere. The FRD's full 9-role list
 * (Student/Teacher/Officer/Club Account/Society Account) is represented
 * on the applicant side via `ApplicantProfile`, not `UserRole` — that's a
 * separate decision for whoever owns that module, not something this
 * change makes for them.
 */
export type UserRole =
  | "Applicant"
  | "DepartmentHead"
  | "TransportInCharge"
  | "TransportAdministrator"
  | "SuperAdmin";

export type ApplicantProfile = "Teacher" | "Student" | "Officer";

export const APPLICANT_PROFILES: ApplicantProfile[] = [
  "Teacher",
  "Student",
  "Officer",
];

export interface UserAccount {
  id: string;
  email: string;
  role: UserRole;

  applicantProfile?: ApplicantProfile;
  fullName?: string;
  mobile?: string;
  /** Hash of the account password (see utils/passwordUtils.ts). Set once
   *  the applicant finishes profile setup; used by /login alongside
   *  email. Optional because unverified accounts don't have one yet. */
  passwordHash?: string;
  signatureDataUrl?: string;
  studentRegNumber?: string;
  department?: string;
  office?: string;
  designation?: string;
  /** Optional scope used by recommender workflows to map a DepartmentHead
     *  to a specific department. Departments without a head will have no
     *  matching scope. */
  headOfDepartment?: string;
  /** Optional scope used by recommender workflows to map a DepartmentHead
    *  to a specific office. */
  headOfOffice?: string;
  isVerified: boolean;
  /**
   * Phase 9 (admin module) — account activation, distinct from
   * `isVerified`. `isVerified` means "finished OTP registration," and an
   * unverified account is still allowed to sign in (redirected back into
   * the OTP flow to finish onboarding) — it is NOT a block. `isActive`
   * is the actual sign-in gate: `false` means Super Admin has
   * deactivated this account and it must be signed out / refused login
   * outright, not redirected anywhere to "finish" something. Optional at
   * the type level only because pre-Phase-9 stored data won't have it;
   * useUsers.ts migrates every record to a real boolean (default `true`)
   * on read, so by the time code outside that hook sees a UserAccount,
   * this is effectively always present.
   */
  isActive?: boolean;
  createdAt: string;
}

export const LOCKED_PROFILE_FIELDS_BY_ROLE: Record<UserRole, ReadonlyArray<keyof UserAccount>> = {
  Applicant: [
    "department",
    "office",
    "designation",
    "studentRegNumber",
  ],
  DepartmentHead: ["department", "office"],
  TransportInCharge: [],
  TransportAdministrator: [],
  SuperAdmin: [],
};
