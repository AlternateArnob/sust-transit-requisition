import { describe, expect, it } from "vitest";
import { env } from "../../src/config/env.js";
import { toMeResponse, toPublicUser } from "../../src/modules/users/user.mapper.js";
import type { UserRecord } from "../../src/modules/users/user.repository.js";

const record = (overrides: Partial<UserRecord> = {}): UserRecord => ({
  id: "11111111-1111-4111-8111-111111111111",
  email: "teacher@sust.edu",
  role: "Applicant",
  applicantProfile: "Teacher",
  fullName: "Dr. Rahim Uddin",
  mobile: "01711111111",
  passwordHash: "$argon2id$secret-hash",
  signatureFileId: "22222222-2222-4222-8222-222222222222",
  studentRegNumber: null,
  department: "Computer Science and Engineering",
  office: null,
  designation: "Professor",
  headOfDepartment: null,
  headOfOffice: null,
  isVerified: true,
  isActive: true,
  failedLoginCount: 3,
  lockedUntil: "2026-11-26 10:00:00.000",
  lastLoginAt: "2026-11-26 09:00:00.000",
  createdAt: "2026-11-25 08:00:00.000",
  updatedAt: "2026-11-26 08:00:00.000",
  ...overrides,
});

describe("toPublicUser", () => {
  it("never exposes the password hash, login counters or the file id", () => {
    const json = JSON.stringify(toPublicUser(record()));
    expect(json).not.toContain("argon2");
    expect(json).not.toContain("passwordHash");
    expect(json).not.toContain("failedLoginCount");
    expect(json).not.toContain("lockedUntil");
    expect(json).not.toContain("signatureFileId");
    expect(json).not.toContain("updatedAt");
  });

  it("returns camelCase fields, an ISO createdAt and a signature URL", () => {
    expect(toPublicUser(record())).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      email: "teacher@sust.edu",
      role: "Applicant",
      applicantProfile: "Teacher",
      fullName: "Dr. Rahim Uddin",
      mobile: "01711111111",
      department: "Computer Science and Engineering",
      designation: "Professor",
      hasSignature: true,
      signatureUrl: `${env.API_BASE_PATH}/files/22222222-2222-4222-8222-222222222222`,
      isVerified: true,
      isActive: true,
      createdAt: "2026-11-25T08:00:00.000Z",
    });
  });

  it("leaves empty optional fields out and reports no signature", () => {
    const user = toPublicUser(
      record({
        applicantProfile: null,
        fullName: null,
        mobile: null,
        department: null,
        designation: null,
        signatureFileId: null,
      }),
    );
    expect(user).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      email: "teacher@sust.edu",
      role: "Applicant",
      hasSignature: false,
      isVerified: true,
      isActive: true,
      createdAt: "2026-11-25T08:00:00.000Z",
    });
    expect(user).not.toHaveProperty("signatureUrl");
  });

  it("includes the Department Head scope", () => {
    const user = toPublicUser(record({ role: "DepartmentHead", headOfDepartment: "Physics" }));
    expect(user.headOfDepartment).toBe("Physics");
  });
});

describe("toMeResponse", () => {
  it("has no nextStep for a finished account", () => {
    expect(toMeResponse(record())).not.toHaveProperty("nextStep");
  });

  it('says "otp" for an unverified account and "profile-setup" for one without a password', () => {
    expect(toMeResponse(record({ isVerified: false })).nextStep).toBe("otp");
    expect(toMeResponse(record({ passwordHash: null })).nextStep).toBe("profile-setup");
    expect(toMeResponse(record({ signatureFileId: null })).nextStep).toBe("profile-setup");
  });
});
