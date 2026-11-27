import { describe, expect, it } from "vitest";
import { PASSWORD_MAX_LENGTH } from "../../src/services/password.js";
import {
  changePasswordBody,
  signatureJsonBody,
  updateProfileBody,
} from "../../src/modules/users/profile.schemas.js";

const valid = { fullName: "Dr. Rahim Uddin", mobile: "01712-345678" };
const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

describe("updateProfileBody", () => {
  it("accepts the minimum (name and mobile) and trims text", () => {
    const parsed = updateProfileBody.parse({
      fullName: "  Dr. Rahim Uddin ",
      mobile: " 01712345678 ",
      department: "  Physics ",
    });
    expect(parsed).toEqual({
      fullName: "Dr. Rahim Uddin",
      mobile: "01712345678",
      department: "Physics",
    });
  });

  it("requires a name and a mobile number, with the frontend's wording", () => {
    expect(messages(updateProfileBody.safeParse({ fullName: "  ", mobile: "" }))).toEqual([
      "Full name is required.",
      "Mobile number is required.",
    ]);
  });

  it.each(["01712345678", "+880 1712 345678", "(02) 8812-3456", "017-1234-5678"])(
    "accepts the mobile number %j",
    (mobile) => {
      expect(updateProfileBody.safeParse({ ...valid, mobile }).success).toBe(true);
    },
  );

  it.each(["abc", "1234", "0171234567x", "<script>", "0".repeat(31)])(
    "rejects the mobile number %j",
    (mobile) => {
      const result = updateProfileBody.safeParse({ ...valid, mobile });
      expect(result.success).toBe(false);
      expect(messages(result)).toEqual(["Enter a valid mobile number."]);
    },
  );

  it("rejects unknown keys, so a typo or an attempt to set the role is not silently ignored", () => {
    for (const extra of [
      { role: "SuperAdmin" },
      { headOfDepartment: "Physics" },
      { isVerified: true },
    ]) {
      expect(updateProfileBody.safeParse({ ...valid, ...extra }).success).toBe(false);
    }
  });

  it("only allows the three applicant types", () => {
    expect(updateProfileBody.safeParse({ ...valid, applicantProfile: "Teacher" }).success).toBe(
      true,
    );
    expect(updateProfileBody.safeParse({ ...valid, applicantProfile: "Club" }).success).toBe(false);
    expect(messages(updateProfileBody.safeParse({ ...valid, applicantProfile: "" }))).toEqual([
      "Select your applicant type.",
    ]);
  });

  it("limits field lengths to the column sizes", () => {
    expect(updateProfileBody.safeParse({ ...valid, fullName: "a".repeat(151) }).success).toBe(
      false,
    );
    expect(updateProfileBody.safeParse({ ...valid, department: "a".repeat(201) }).success).toBe(
      false,
    );
    expect(updateProfileBody.safeParse({ ...valid, designation: "a".repeat(151) }).success).toBe(
      false,
    );
    expect(
      updateProfileBody.safeParse({ ...valid, studentRegNumber: "1".repeat(51) }).success,
    ).toBe(false);
  });

  it("does not trim a password and caps its length", () => {
    expect(updateProfileBody.parse({ ...valid, password: "  spaces kept  " }).password).toBe(
      "  spaces kept  ",
    );
    expect(
      updateProfileBody.safeParse({ ...valid, password: "x".repeat(PASSWORD_MAX_LENGTH + 1) })
        .success,
    ).toBe(false);
  });
});

describe("changePasswordBody", () => {
  it("needs both passwords and rejects extra keys", () => {
    expect(changePasswordBody.safeParse({ currentPassword: "a", newPassword: "b" }).success).toBe(
      true,
    );
    expect(changePasswordBody.safeParse({ currentPassword: "a" }).success).toBe(false);
    expect(changePasswordBody.safeParse({ newPassword: "b" }).success).toBe(false);
    expect(
      changePasswordBody.safeParse({ currentPassword: "a", newPassword: "b", extra: 1 }).success,
    ).toBe(false);
  });
});

describe("signatureJsonBody", () => {
  it("needs exactly signatureDataUrl", () => {
    expect(
      signatureJsonBody.safeParse({ signatureDataUrl: "data:image/png;base64,AAAA" }).success,
    ).toBe(true);
    expect(signatureJsonBody.safeParse({}).success).toBe(false);
    expect(signatureJsonBody.safeParse({ signatureDataUrl: "" }).success).toBe(false);
    expect(signatureJsonBody.safeParse({ signatureDataUrl: "x", other: 1 }).success).toBe(false);
  });
});
