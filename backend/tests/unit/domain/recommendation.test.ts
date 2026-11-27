import { describe, expect, it } from "vitest";
import {
  APPLICANT_PROFILES,
  REQUISITION_TYPES,
  type ApplicantProfile,
} from "../../../src/config/constants.js";
import {
  SUST_EMAIL_DOMAINS,
  departmentScopeMatches,
  isSustEmail,
  requiresRecommendation,
  resolveSubmissionStatus,
  snapshotDepartment,
} from "../../../src/domain/recommendation.js";

describe("requiresRecommendation (Part 1 §11.3)", () => {
  const profiles: (ApplicantProfile | undefined | null)[] = [
    ...APPLICANT_PROFILES,
    undefined,
    null,
  ];

  for (const profile of profiles) {
    for (const type of REQUISITION_TYPES) {
      for (const role of ["Applicant", "DepartmentHead", undefined] as const) {
        const expected =
          role !== "DepartmentHead" && type === "Departmental/Official" && Boolean(profile);
        it(`${profile ?? "no profile"} + ${type} + ${role ?? "no role"} -> ${expected}`, () => {
          expect(requiresRecommendation(profile, type, role)).toBe(expected);
        });
      }
    }
  }

  it("is only true for Departmental/Official requisitions by Students, Teachers and Officers", () => {
    for (const profile of APPLICANT_PROFILES) {
      expect(requiresRecommendation(profile, "Departmental/Official", "Applicant")).toBe(true);
      expect(requiresRecommendation(profile, "Personal", "Applicant")).toBe(false);
      expect(requiresRecommendation(profile, "Club", "Applicant")).toBe(false);
    }
  });

  it("is never true for a Department Head (they are their own recommender)", () => {
    for (const profile of APPLICANT_PROFILES) {
      expect(requiresRecommendation(profile, "Departmental/Official", "DepartmentHead")).toBe(
        false,
      );
    }
  });
});

describe("resolveSubmissionStatus (§11.3 and §11.4)", () => {
  it("sends an Official requisition by a Student/Teacher/Officer to Pending Recommendation", () => {
    for (const profile of APPLICANT_PROFILES) {
      expect(
        resolveSubmissionStatus({
          profile,
          requisitionType: "Departmental/Official",
          role: "Applicant",
        }),
      ).toBe("Pending Recommendation");
    }
  });

  it("sends Personal and Club requisitions straight to the Transport Office", () => {
    expect(resolveSubmissionStatus({ profile: "Teacher", requisitionType: "Personal" })).toBe(
      "Pending on Transport Office",
    );
    expect(resolveSubmissionStatus({ profile: "Student", requisitionType: "Club" })).toBe(
      "Pending on Transport Office",
    );
  });

  it("sends a Department Head's own Official requisition straight to the Transport Office", () => {
    expect(
      resolveSubmissionStatus({
        profile: "Teacher",
        requisitionType: "Departmental/Official",
        role: "DepartmentHead",
      }),
    ).toBe("Pending on Transport Office");
  });

  it("does not ask the head again when a recommender is already on record (resubmission)", () => {
    expect(
      resolveSubmissionStatus({
        profile: "Teacher",
        requisitionType: "Departmental/Official",
        role: "Applicant",
        hasRecommender: true,
      }),
    ).toBe("Pending on Transport Office");
  });
});

describe("isSustEmail", () => {
  it("lists the two accepted domains", () => {
    expect([...SUST_EMAIL_DOMAINS]).toEqual(["sust.edu", "student.sust.edu"]);
  });

  it.each([
    "teacher@sust.edu",
    "2020331001@student.sust.edu",
    "Teacher@SUST.EDU",
    "  teacher@sust.edu  ",
    "head@cse.sust.edu",
    "x@dept.student.sust.edu",
  ])("accepts %j", (email) => {
    expect(isSustEmail(email)).toBe(true);
  });

  it.each([
    "someone@gmail.com",
    "someone@evilsust.edu",
    "someone@sust.edu.evil.com",
    "someone@notsust.edu",
    "@sust.edu",
    "no-at-sign",
    "a@b@sust.edu",
    "",
    "someone@",
  ])("rejects %j", (email) => {
    expect(isSustEmail(email)).toBe(false);
  });
});

describe("departmentScopeMatches (§11.11)", () => {
  const head = { headOfDepartment: "Computer Science and Engineering", headOfOffice: null };

  it("matches head_of_department, ignoring case and surrounding spaces", () => {
    expect(departmentScopeMatches("Computer Science and Engineering", head)).toBe(true);
    expect(departmentScopeMatches("  computer science and engineering ", head)).toBe(true);
  });

  it("matches head_of_office for office requisitions", () => {
    expect(departmentScopeMatches("Registrar Office", { headOfOffice: "registrar office" })).toBe(
      true,
    );
  });

  it("does not match another department", () => {
    expect(departmentScopeMatches("Physics", head)).toBe(false);
  });

  it("never matches an empty department, even for a head with no scope", () => {
    expect(departmentScopeMatches("", {})).toBe(false);
    expect(departmentScopeMatches(null, {})).toBe(false);
    expect(departmentScopeMatches(undefined, { headOfDepartment: "" })).toBe(false);
    expect(departmentScopeMatches("   ", { headOfDepartment: "   " })).toBe(false);
  });
});

describe("snapshotDepartment", () => {
  it("prefers the department and falls back to the office", () => {
    expect(snapshotDepartment({ department: " Physics ", office: "Registrar" })).toBe("Physics");
    expect(snapshotDepartment({ department: null, office: "Registrar" })).toBe("Registrar");
    expect(snapshotDepartment({ department: "  ", office: " Registrar " })).toBe("Registrar");
    expect(snapshotDepartment({})).toBeNull();
  });
});
