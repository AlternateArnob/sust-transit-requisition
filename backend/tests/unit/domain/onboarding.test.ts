import { describe, expect, it } from "vitest";
import {
  getNextStep,
  isOnboardingComplete,
  missingProfileFields,
  needsApplicantProfile,
  type OnboardingSubject,
} from "../../../src/domain/onboarding.js";

const complete = (overrides: Partial<OnboardingSubject> = {}): OnboardingSubject => ({
  role: "Applicant",
  isVerified: true,
  hasPassword: true,
  hasSignature: true,
  applicantProfile: "Teacher",
  fullName: "Dr. Rahim Uddin",
  mobile: "01711111111",
  department: "Computer Science and Engineering",
  office: null,
  designation: "Professor",
  studentRegNumber: null,
  ...overrides,
});

describe("needsApplicantProfile", () => {
  it("is true for Applicant and DepartmentHead only", () => {
    expect(needsApplicantProfile("Applicant")).toBe(true);
    expect(needsApplicantProfile("DepartmentHead")).toBe(true);
    expect(needsApplicantProfile("TransportInCharge")).toBe(false);
    expect(needsApplicantProfile("TransportAdministrator")).toBe(false);
    expect(needsApplicantProfile("SuperAdmin")).toBe(false);
  });
});

describe("missingProfileFields", () => {
  it("is empty for a complete Teacher", () => {
    expect(missingProfileFields(complete())).toEqual([]);
  });

  it("asks for everything when nothing is filled in", () => {
    expect(
      missingProfileFields(
        complete({
          fullName: null,
          mobile: null,
          hasSignature: false,
          applicantProfile: null,
          department: null,
          designation: null,
        }),
      ),
    ).toEqual(["fullName", "mobile", "signature", "applicantProfile"]);
  });

  it("Student needs department and registration number", () => {
    const student = complete({ applicantProfile: "Student", designation: null });
    expect(missingProfileFields(student)).toEqual(["studentRegNumber"]);
    expect(
      missingProfileFields({ ...student, department: null, studentRegNumber: "2020331001" }),
    ).toEqual(["department"]);
    expect(missingProfileFields({ ...student, studentRegNumber: "2020331001" })).toEqual([]);
  });

  it("Teacher needs department and designation", () => {
    expect(missingProfileFields(complete({ designation: null }))).toEqual(["designation"]);
    expect(missingProfileFields(complete({ department: null }))).toEqual(["department"]);
  });

  it("Officer needs office and designation (not a department)", () => {
    const officer = complete({
      applicantProfile: "Officer",
      department: null,
      office: "Registrar Office",
    });
    expect(missingProfileFields(officer)).toEqual([]);
    expect(missingProfileFields({ ...officer, office: null })).toEqual(["office"]);
    expect(missingProfileFields({ ...officer, designation: null })).toEqual(["designation"]);
  });

  it("treats whitespace-only values as missing", () => {
    expect(missingProfileFields(complete({ fullName: "   ", mobile: "" }))).toEqual([
      "fullName",
      "mobile",
    ]);
  });

  it("applies the same rules to a DepartmentHead", () => {
    expect(missingProfileFields(complete({ role: "DepartmentHead", hasSignature: false }))).toEqual(
      ["signature"],
    );
  });

  it("asks nothing of Transport Office and Super Admin accounts", () => {
    for (const role of ["TransportInCharge", "TransportAdministrator", "SuperAdmin"] as const) {
      expect(
        missingProfileFields(
          complete({
            role,
            applicantProfile: null,
            fullName: null,
            mobile: null,
            hasSignature: false,
          }),
        ),
      ).toEqual([]);
    }
  });
});

describe("getNextStep", () => {
  it("is null for a finished account", () => {
    expect(getNextStep(complete())).toBeNull();
    expect(isOnboardingComplete(complete())).toBe(true);
  });

  it('is "otp" while the email is unverified, whatever else is missing', () => {
    expect(getNextStep(complete({ isVerified: false }))).toBe("otp");
    expect(getNextStep(complete({ isVerified: false, hasPassword: false }))).toBe("otp");
  });

  it('is "profile-setup" for a verified account without a password', () => {
    expect(getNextStep(complete({ hasPassword: false }))).toBe("profile-setup");
  });

  it('is "profile-setup" while the applicant profile is incomplete', () => {
    expect(getNextStep(complete({ hasSignature: false }))).toBe("profile-setup");
    expect(getNextStep(complete({ applicantProfile: null }))).toBe("profile-setup");
    expect(isOnboardingComplete(complete({ fullName: null }))).toBe(false);
  });

  it("a Transport Office account is ready once verified and given a password", () => {
    const admin = complete({ role: "TransportInCharge", applicantProfile: null, fullName: null });
    expect(getNextStep(admin)).toBeNull();
    expect(getNextStep({ ...admin, hasPassword: false })).toBe("profile-setup");
  });
});
