export type UserRole = "Applicant" | "DepartmentHead" | "Admin";

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
  Admin: [], };
