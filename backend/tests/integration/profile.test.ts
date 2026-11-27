import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { resetRateLimitStores } from "../../src/middleware/rateLimit.js";
import { verifyPassword } from "../../src/services/password.js";
import { db, truncateAll } from "../helpers/db.js";
import { createUser } from "../helpers/factories.js";
import { resetUploads } from "../helpers/files.js";
import {
  bearer,
  createFileRow,
  createFreshApplicant,
  createUserWithPassword,
  seedDirectory,
} from "../helpers/session.js";

const BASE = env.API_BASE_PATH;
const app = createApp();
const NEW_PASSWORD = "a-brand-new-password";

const put = (token: Record<string, string>, body: object) =>
  request(app).put(`${BASE}/me/profile`).set(token).send(body);
const getMe = (token: Record<string, string>) => request(app).get(`${BASE}/me`).set(token);
const userRow = (id: unknown) => db("users").where({ id }).first();

/** Gives a user a signature, as `POST /me/signature` would. */
async function giveSignature(user: Record<string, unknown>) {
  const file = await createFileRow(user.id);
  await db("users").where({ id: user.id }).update({ signature_file_id: file.id });
  return file;
}

const teacher = {
  applicantProfile: "Teacher",
  fullName: "Dr. Rahim Uddin",
  mobile: "01711111111",
  department: "Computer Science and Engineering",
  designation: "Professor",
};
const student = {
  applicantProfile: "Student",
  fullName: "Nusrat Jahan",
  mobile: "01822222222",
  department: "Physics",
  studentRegNumber: "2019331001",
};
const officer = {
  applicantProfile: "Officer",
  fullName: "Karim Mia",
  mobile: "01933333333",
  office: "Central Library",
  designation: "Assistant Librarian",
};

const errorPaths = (res: request.Response): string[] =>
  (res.body.error.details as { path: string }[]).map((detail) => detail.path).sort();

beforeEach(async () => {
  await truncateAll();
  resetRateLimitStores();
  resetUploads();
  await seedDirectory();
});

afterAll(async () => {
  await db.destroy();
});

// =============================================================================================
// GET /me
// =============================================================================================

describe("GET /me", () => {
  it("returns the caller's own profile and never the password hash", async () => {
    const user = await createUserWithPassword({
      full_name: "Test User",
      mobile: "01700000000",
      applicant_profile: "Teacher",
      department: "Physics",
      designation: "Lecturer",
    });
    const res = await getMe(bearer(user));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: user.id,
      email: user.email,
      role: "Applicant",
      fullName: "Test User",
      department: "Physics",
      hasSignature: false,
      isVerified: true,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/password|argon2/i);
  });

  it("includes nextStep while the profile is unfinished and leaves it out when finished", async () => {
    const unfinished = await createUserWithPassword();
    expect((await getMe(bearer(unfinished))).body.nextStep).toBe("profile-setup");

    const finished = await createUserWithPassword({
      ...{ full_name: "A", mobile: "01700000000", applicant_profile: "Teacher" },
      department: "Physics",
      designation: "Lecturer",
    });
    await giveSignature(finished);
    const res = await getMe(bearer(finished));
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("nextStep");
  });

  it("returns signatureUrl once a signature exists", async () => {
    const user = await createUserWithPassword();
    const file = await giveSignature(user);
    const res = await getMe(bearer(user));
    expect(res.body).toMatchObject({
      hasSignature: true,
      signatureUrl: `${BASE}/files/${file.id}`,
    });
  });

  it("needs a login, and an onboarding token is not enough", async () => {
    const user = await createFreshApplicant();
    expect((await request(app).get(`${BASE}/me`)).status).toBe(401);
    const res = await getMe(bearer(user, "onboarding"));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("refuses a deactivated account", async () => {
    const user = await createUserWithPassword({ is_active: 0 });
    const res = await getMe(bearer(user));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_DEACTIVATED");
  });
});

// =============================================================================================
// PUT /me/profile: who may call it and what is validated
// =============================================================================================

describe("PUT /me/profile: access", () => {
  it("needs authentication", async () => {
    const res = await request(app).put(`${BASE}/me/profile`).send(teacher);
    expect(res.status).toBe(401);
  });

  it("accepts an onboarding token", async () => {
    const user = await createFreshApplicant();
    await giveSignature(user);
    const res = await put(bearer(user, "onboarding"), { ...teacher, password: NEW_PASSWORD });
    expect(res.status).toBe(200);
  });

  it("refuses an unverified account even with an onboarding token (defence in depth)", async () => {
    const user = await createUser({ is_verified: 0 });
    const res = await put(bearer(user, "onboarding"), { ...teacher, password: NEW_PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_NOT_VERIFIED");
    expect((await userRow(user.id)).full_name).toBeNull();
    expect((await userRow(user.id)).password_hash).toBeNull();
  });

  it("refuses a deactivated account", async () => {
    const user = await createFreshApplicant({ is_active: 0 });
    const res = await put(bearer(user, "onboarding"), teacher);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_DEACTIVATED");
  });
});

describe("PUT /me/profile: body validation", () => {
  it("rejects unknown keys, including attempts to set the role or head scope", async () => {
    const user = await createFreshApplicant();
    for (const extra of [
      { role: "SuperAdmin" },
      { headOfDepartment: "Physics" },
      { isVerified: 1 },
    ]) {
      const res = await put(bearer(user, "onboarding"), { ...teacher, ...extra });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
    expect((await userRow(user.id)).role).toBe("Applicant");
  });

  it("requires full name and mobile, using the frontend's messages", async () => {
    const user = await createFreshApplicant();
    const res = await put(bearer(user, "onboarding"), { applicantProfile: "Teacher" });
    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        { path: "fullName", message: expect.any(String) },
        { path: "mobile", message: expect.any(String) },
      ]),
    );
  });

  it("rejects a malformed mobile number", async () => {
    const user = await createFreshApplicant();
    const res = await put(bearer(user, "onboarding"), { ...teacher, mobile: "call me" });
    expect(res.status).toBe(422);
    expect(errorPaths(res)).toEqual(["mobile"]);
  });

  it("rejects an applicant type that does not exist", async () => {
    const user = await createFreshApplicant();
    const res = await put(bearer(user, "onboarding"), { ...teacher, applicantProfile: "Alumnus" });
    expect(res.status).toBe(422);
    expect(errorPaths(res)).toEqual(["applicantProfile"]);
  });
});

// =============================================================================================
// PUT /me/profile: onboarding completes only when everything is valid
// =============================================================================================

describe("PUT /me/profile: completing onboarding", () => {
  it.each([
    ["Teacher", teacher],
    ["Student", student],
    ["Officer", officer],
  ])(
    "completes a %s with signature and password, after which nextStep is gone",
    async (_type, body) => {
      const user = await createFreshApplicant();
      await giveSignature(user);

      const res = await put(bearer(user, "onboarding"), { ...body, password: NEW_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: user.id,
        role: "Applicant",
        applicantProfile: body.applicantProfile,
        fullName: body.fullName,
        mobile: body.mobile,
        hasSignature: true,
      });
      expect(res.body).not.toHaveProperty("nextStep");
      expect(JSON.stringify(res.body)).not.toMatch(/password|argon2/i);

      const row = await userRow(user.id);
      expect(await verifyPassword(row.password_hash, NEW_PASSWORD)).toBe(true);
      expect(row.password_hash).not.toContain(NEW_PASSWORD);
    },
  );

  it("requires the signature to be uploaded first", async () => {
    const user = await createFreshApplicant();
    const res = await put(bearer(user, "onboarding"), { ...teacher, password: NEW_PASSWORD });
    expect(res.status).toBe(422);
    expect(errorPaths(res)).toEqual(["signature"]);
    expect(res.body.error.details[0].message).toBe("Signature is required.");
  });

  it("requires a password the first time", async () => {
    const user = await createFreshApplicant();
    await giveSignature(user);
    const res = await put(bearer(user, "onboarding"), teacher);
    expect(res.status).toBe(422);
    expect(errorPaths(res)).toEqual(["password"]);
    expect((await userRow(user.id)).full_name).toBeNull();
  });

  it("enforces the password length policy", async () => {
    const user = await createFreshApplicant();
    await giveSignature(user);
    const res = await put(bearer(user, "onboarding"), {
      ...teacher,
      password: "x".repeat(env.PASSWORD_MIN_LENGTH - 1),
    });
    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual([
      {
        path: "password",
        message: `Password must be at least ${env.PASSWORD_MIN_LENGTH} characters`,
      },
    ]);
  });

  it("requires an applicant type the first time", async () => {
    const user = await createFreshApplicant();
    await giveSignature(user);
    const withoutType = { ...teacher, applicantProfile: undefined }; // JSON drops it
    const res = await put(bearer(user, "onboarding"), { ...withoutType, password: NEW_PASSWORD });
    expect(res.status).toBe(422);
    expect(errorPaths(res)).toEqual(["applicantProfile"]);
  });

  it("reports every problem at once, not one at a time", async () => {
    const user = await createFreshApplicant();
    const res = await put(bearer(user, "onboarding"), {
      applicantProfile: "Student",
      fullName: "Nusrat",
      mobile: "01822222222",
    });
    expect(res.status).toBe(422);
    expect(errorPaths(res)).toEqual(["department", "password", "signature", "studentRegNumber"]);
  });

  it("saves nothing when validation fails", async () => {
    const user = await createFreshApplicant();
    const res = await put(bearer(user, "onboarding"), { ...student, department: "Atlantis" });
    expect(res.status).toBe(422);
    const row = await userRow(user.id);
    expect([row.full_name, row.mobile, row.applicant_profile, row.department]).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });
});

describe("PUT /me/profile: fields required for each applicant type", () => {
  const complete = async () => {
    const user = await createFreshApplicant();
    await giveSignature(user);
    return user;
  };
  const base = (type: string) => ({
    applicantProfile: type,
    fullName: "Someone",
    mobile: "01700000000",
    password: NEW_PASSWORD,
  });

  it("Student needs department and registration number", async () => {
    const user = await complete();
    const res = await put(bearer(user, "onboarding"), base("Student"));
    expect(errorPaths(res)).toEqual(["department", "studentRegNumber"]);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        { path: "department", message: "Department is required." },
        { path: "studentRegNumber", message: "Registration number is required." },
      ]),
    );
  });

  it("Teacher needs department and designation", async () => {
    const user = await complete();
    const res = await put(bearer(user, "onboarding"), base("Teacher"));
    expect(errorPaths(res)).toEqual(["department", "designation"]);
  });

  it("Officer needs office and designation, not a department", async () => {
    const user = await complete();
    const res = await put(bearer(user, "onboarding"), base("Officer"));
    expect(errorPaths(res)).toEqual(["designation", "office"]);
  });

  it("treats blank and whitespace-only values as missing", async () => {
    const user = await complete();
    const res = await put(bearer(user, "onboarding"), {
      ...base("Teacher"),
      department: "   ",
      designation: "",
    });
    expect(errorPaths(res)).toEqual(["department", "designation"]);
  });
});

describe("PUT /me/profile: department and office come from the directory", () => {
  const ready = async () => {
    const user = await createFreshApplicant();
    await giveSignature(user);
    return user;
  };

  it("rejects an unknown department", async () => {
    const user = await ready();
    const res = await put(bearer(user, "onboarding"), {
      ...teacher,
      department: "Department of Made-Up Studies",
      password: NEW_PASSWORD,
    });
    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual([
      { path: "department", message: "Select a department from the list." },
    ]);
  });

  it("rejects an unknown office", async () => {
    const user = await ready();
    const res = await put(bearer(user, "onboarding"), {
      ...officer,
      office: "Office of Nowhere",
      password: NEW_PASSWORD,
    });
    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual([
      { path: "office", message: "Select an office from the list." },
    ]);
  });

  it("does not accept an office where a department is expected, or the reverse", async () => {
    const user = await ready();
    const asDepartment = await put(bearer(user, "onboarding"), {
      ...teacher,
      department: "Central Library",
      password: NEW_PASSWORD,
    });
    expect(errorPaths(asDepartment)).toEqual(["department"]);
    const asOffice = await put(bearer(user, "onboarding"), {
      ...officer,
      office: "Physics",
      password: NEW_PASSWORD,
    });
    expect(errorPaths(asOffice)).toEqual(["office"]);
  });

  it("rejects a department that has been switched off", async () => {
    await db("directory_units").where({ name: "Physics" }).update({ is_active: 0 });
    const user = await ready();
    const res = await put(bearer(user, "onboarding"), { ...student, password: NEW_PASSWORD });
    expect(errorPaths(res)).toEqual(["department"]);
  });

  it("stores the directory's spelling, whatever case was typed", async () => {
    const user = await ready();
    const res = await put(bearer(user, "onboarding"), {
      ...teacher,
      department: "  computer SCIENCE and engineering ",
      password: NEW_PASSWORD,
    });
    expect(res.status).toBe(200);
    expect(res.body.department).toBe("Computer Science and Engineering");
    expect((await userRow(user.id)).department).toBe("Computer Science and Engineering");
  });
});

describe("PUT /me/profile: fields that do not belong to the applicant type", () => {
  it("ignores them and stores them empty, instead of letting stale values linger", async () => {
    const user = await createFreshApplicant();
    await giveSignature(user);
    // A form that still holds values typed before the applicant switched type.
    const res = await put(bearer(user, "onboarding"), {
      ...officer,
      department: "Physics",
      studentRegNumber: "2019331001",
      password: NEW_PASSWORD,
    });
    expect(res.status).toBe(200);
    const row = await userRow(user.id);
    expect(row).toMatchObject({
      applicant_profile: "Officer",
      office: "Central Library",
      designation: "Assistant Librarian",
      department: null,
      student_reg_number: null,
    });
  });

  it("does not validate an ignored field either", async () => {
    const user = await createFreshApplicant();
    await giveSignature(user);
    const res = await put(bearer(user, "onboarding"), {
      ...student,
      office: "Not a real office",
      password: NEW_PASSWORD,
    });
    expect(res.status).toBe(200);
    expect((await userRow(user.id)).office).toBeNull();
  });
});

// =============================================================================================
// PUT /me/profile: updating an existing profile
// =============================================================================================

describe("PUT /me/profile: updating later", () => {
  const completeTeacher = async (overrides: Record<string, unknown> = {}) => {
    const user = await createUserWithPassword({
      full_name: "Old Name",
      mobile: "01700000000",
      applicant_profile: "Teacher",
      department: "Physics",
      designation: "Lecturer",
      ...overrides,
    });
    await giveSignature(user);
    return user;
  };

  it("changes the fields that were sent and keeps the ones that were left out", async () => {
    const user = await completeTeacher();
    const res = await put(bearer(user), { fullName: "New Name", mobile: "01799999999" });
    expect(res.status).toBe(200);
    expect(await userRow(user.id)).toMatchObject({
      full_name: "New Name",
      mobile: "01799999999",
      applicant_profile: "Teacher",
      department: "Physics",
      designation: "Lecturer",
    });
  });

  it("needs no password and keeps the existing one", async () => {
    const user = await completeTeacher();
    const before = (await userRow(user.id)).password_hash;
    const res = await put(bearer(user), { ...teacher });
    expect(res.status).toBe(200);
    expect((await userRow(user.id)).password_hash).toBe(before);
  });

  it("treats an empty password string as 'not changing it'", async () => {
    const user = await completeTeacher();
    const res = await put(bearer(user), { ...teacher, password: "" });
    expect(res.status).toBe(200);
  });

  it("refuses to change an existing password here and points to the change-password form", async () => {
    const user = await completeTeacher();
    const before = (await userRow(user.id)).password_hash;
    const res = await put(bearer(user), { ...teacher, password: NEW_PASSWORD });
    expect(res.status).toBe(422);
    expect(errorPaths(res)).toEqual(["password"]);
    expect(res.body.error.details[0].message).toMatch(/change-password/);
    expect((await userRow(user.id)).password_hash).toBe(before);
    expect((await userRow(user.id)).full_name).toBe("Old Name");
  });

  it("switching from Teacher to Officer clears the department and keeps the designation field in use", async () => {
    const user = await completeTeacher();
    const res = await put(bearer(user), { ...officer });
    expect(res.status).toBe(200);
    expect(await userRow(user.id)).toMatchObject({
      applicant_profile: "Officer",
      office: "Central Library",
      designation: "Assistant Librarian",
      department: null,
    });
  });

  it("switching type still demands the new type's fields", async () => {
    const user = await completeTeacher();
    const res = await put(bearer(user), {
      applicantProfile: "Student",
      fullName: "Old Name",
      mobile: "01700000000",
    });
    expect(res.status).toBe(422);
    expect(errorPaths(res)).toEqual(["studentRegNumber"]);
    expect((await userRow(user.id)).applicant_profile).toBe("Teacher");
  });

  it("a previously stored value is enough to satisfy a required field", async () => {
    const user = await completeTeacher();
    const res = await put(bearer(user), {
      applicantProfile: "Teacher",
      fullName: "Old Name",
      mobile: "01700000000",
    });
    expect(res.status).toBe(200);
  });

  it("a blank value sent for a required field is an error, not 'keep the old one'", async () => {
    const user = await completeTeacher();
    const res = await put(bearer(user), { ...teacher, designation: "  " });
    expect(res.status).toBe(422);
    expect(errorPaths(res)).toEqual(["designation"]);
  });
});

// =============================================================================================
// PUT /me/profile: roles
// =============================================================================================

describe("PUT /me/profile: Department Head", () => {
  it("fills in the applicant profile like an applicant, and head scope is untouched", async () => {
    const head = await createUserWithPassword({
      role: "DepartmentHead",
      head_of_department: "Physics",
    });
    await giveSignature(head);

    const res = await put(bearer(head), { ...teacher, department: "Physics" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      role: "DepartmentHead",
      applicantProfile: "Teacher",
      department: "Physics",
      headOfDepartment: "Physics",
    });
    expect((await userRow(head.id)).head_of_department).toBe("Physics");
  });

  it("needs a signature and an applicant profile like any applicant", async () => {
    const head = await createUserWithPassword({ role: "DepartmentHead" });
    const res = await put(bearer(head), { fullName: "Head", mobile: "01700000000" });
    expect(errorPaths(res)).toEqual(["applicantProfile", "signature"]);
  });
});

describe.each(["TransportInCharge", "TransportAdministrator", "SuperAdmin"] as const)(
  "PUT /me/profile: %s",
  (role) => {
    it("may change name and mobile only, and needs no signature or applicant profile", async () => {
      const staff = await createUserWithPassword({ role, full_name: "Old", mobile: "01700000000" });
      const res = await put(bearer(staff), { fullName: "New Name", mobile: "01788888888" });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ role, fullName: "New Name", mobile: "01788888888" });
      expect(res.body).not.toHaveProperty("nextStep");
    });

    it("cannot set applicant-only fields", async () => {
      const staff = await createUserWithPassword({ role, full_name: "Old", mobile: "01700000000" });
      const res = await put(bearer(staff), { ...teacher, designation: "Professor" });
      expect(res.status).toBe(422);
      expect(errorPaths(res)).toEqual(["applicantProfile", "department", "designation"]);
      expect(res.body.error.details[0].message).toBe("This field cannot be changed for your role.");
      expect((await userRow(staff.id)).full_name).toBe("Old");
    });

    it("ignores blank applicant-only fields, so a generic form can send them", async () => {
      const staff = await createUserWithPassword({ role });
      const res = await put(bearer(staff), {
        fullName: "Staff",
        mobile: "01700000000",
        department: "",
        designation: "  ",
      });
      expect(res.status).toBe(200);
      expect(await userRow(staff.id)).toMatchObject({ department: null, designation: null });
    });

    it("cannot use this endpoint to change the role", async () => {
      const staff = await createUserWithPassword({ role });
      const res = await put(bearer(staff), {
        fullName: "X",
        mobile: "01700000000",
        role: "SuperAdmin",
      });
      expect(res.status).toBe(422);
      expect((await userRow(staff.id)).role).toBe(role);
    });
  },
);

describe("PUT /me/profile: a password-less staff account", () => {
  it("must set a password through this endpoint, then needs no applicant profile", async () => {
    const staff = await createFreshApplicant({ role: "TransportInCharge" });
    const without = await put(bearer(staff, "onboarding"), {
      fullName: "S",
      mobile: "01700000000",
    });
    expect(errorPaths(without)).toEqual(["password"]);

    const res = await put(bearer(staff, "onboarding"), {
      fullName: "Staff",
      mobile: "01700000000",
      password: NEW_PASSWORD,
    });
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("nextStep");
  });
});
