import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Transporter } from "nodemailer";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { resetRateLimitStores } from "../../src/middleware/rateLimit.js";
import { setMailTransport } from "../../src/services/mailer.js";
import { db, truncateAll } from "../helpers/db.js";
import { listUploads, resetUploads, tinyPng } from "../helpers/files.js";
import { seedDirectory } from "../helpers/session.js";

const BASE = env.API_BASE_PATH;
const app = createApp();
const stubTransport = { sendMail: vi.fn(async () => ({})) } as unknown as Transporter;
const PASSWORD = "my-own-chosen-password";
const COOKIE_NAME = env.REFRESH_COOKIE_NAME;

const bearerOf = (token: string) => ({ Authorization: `Bearer ${token}` });

beforeEach(async () => {
  await truncateAll();
  resetRateLimitStores();
  resetUploads();
  setMailTransport(stubTransport);
  await seedDirectory();
});

afterAll(async () => {
  setMailTransport(undefined);
  await db.destroy();
});

/** Registers an address and confirms the emailed code; returns what the client then holds. */
async function registerAndVerify(email: string) {
  const registered = await request(app).post(`${BASE}/auth/register`).send({ email });
  expect(registered.status).toBe(202);
  const verified = await request(app)
    .post(`${BASE}/auth/otp/verify`)
    .send({ email, code: registered.body.devCode });
  expect(verified.status).toBe(200);
  return { onboardingToken: verified.body.onboardingToken as string, user: verified.body.user };
}

describe("the new-applicant journey (Part 2 Step 6, 'done when')", () => {
  it("register → verify → signature → profile → log in", async () => {
    const email = "nusrat@student.sust.edu";

    // 1. Register and confirm the email: the client now holds an onboarding token only.
    const { onboardingToken, user } = await registerAndVerify(email);
    const onboarding = bearerOf(onboardingToken);
    const start = await request(app).get(`${BASE}/auth/me`).set(onboarding);
    expect(start.body).toMatchObject({ nextStep: "profile-setup", hasSignature: false });

    // 2. The directory lists feed the form's dropdowns; no login needed.
    const departments = await request(app).get(`${BASE}/directory/departments`);
    expect(departments.body.data).toContain("Physics");

    // 3. Upload the signature, then complete the profile with a first password.
    const signature = await request(app)
      .post(`${BASE}/me/signature`)
      .set(onboarding)
      .attach("file", tinyPng(), { filename: "signature.png", contentType: "image/png" });
    expect(signature.status).toBe(200);
    expect(signature.body.hasSignature).toBe(true);

    const profile = await request(app).put(`${BASE}/me/profile`).set(onboarding).send({
      applicantProfile: "Student",
      fullName: "Nusrat Jahan",
      mobile: "01822222222",
      department: "Physics",
      studentRegNumber: "2019331001",
      password: PASSWORD,
    });
    expect(profile.status).toBe(200);
    expect(profile.body).toMatchObject({
      id: user.id,
      email,
      role: "Applicant",
      applicantProfile: "Student",
      department: "Physics",
      hasSignature: true,
    });
    expect(profile.body).not.toHaveProperty("nextStep");

    // The onboarding step is over: that token can do nothing else.
    const afterwards = await request(app).get(`${BASE}/me`).set(onboarding);
    expect(afterwards.status).toBe(403);

    // 4. Log in with the new password and get a real session.
    const login = await request(app).post(`${BASE}/auth/login`).send({ email, password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.user).toMatchObject({ email, fullName: "Nusrat Jahan", hasSignature: true });
    expect(login.body.user).not.toHaveProperty("nextStep");
    expect(
      (login.headers["set-cookie"] as unknown as string[]).some((c) =>
        c.startsWith(`${COOKIE_NAME}=`),
      ),
    ).toBe(true);

    const session = bearerOf(login.body.accessToken);
    const me = await request(app).get(`${BASE}/me`).set(session);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ applicantProfile: "Student", studentRegNumber: "2019331001" });
    expect(me.body).not.toHaveProperty("nextStep");

    // 5. The stored signature can be fetched with the session.
    const image = await request(app)
      .get(me.body.signatureUrl)
      .set(session)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(image.status).toBe(200);
    expect(image.headers["content-type"]).toMatch(/^image\/png/);

    // 6. Exactly one file exists, on disk and in the database.
    const [row] = await db("files").select();
    expect(row.owner_user_id).toBe(user.id);
    expect(listUploads()).toEqual([row.storage_name]);
    expect(existsSync(join(process.env.UPLOAD_DIR as string, row.storage_name))).toBe(true);
  });

  it("cannot finish without a signature, then can once it is uploaded", async () => {
    const { onboardingToken } = await registerAndVerify("teacher@sust.edu");
    const onboarding = bearerOf(onboardingToken);
    const body = {
      applicantProfile: "Teacher",
      fullName: "Dr. Rahim Uddin",
      mobile: "01711111111",
      department: "Computer Science and Engineering",
      designation: "Professor",
      password: PASSWORD,
    };

    const early = await request(app).put(`${BASE}/me/profile`).set(onboarding).send(body);
    expect(early.status).toBe(422);
    expect(early.body.error.details).toEqual([
      { path: "signature", message: "Signature is required." },
    ]);
    // Nothing was half-saved: the password was not stored, so login still asks for an email code
    // (Step 5's behaviour for an account without a password) and issues no session.
    const refused = await request(app)
      .post(`${BASE}/auth/login`)
      .send({ email: "teacher@sust.edu", password: PASSWORD });
    expect(refused.body).toMatchObject({ nextStep: "otp" });
    expect(refused.body).not.toHaveProperty("accessToken");
    expect(
      (await db("users").where({ email: "teacher@sust.edu" }).first()).password_hash,
    ).toBeNull();

    await request(app)
      .post(`${BASE}/me/signature`)
      .set(onboarding)
      .send({ signatureDataUrl: `data:image/png;base64,${tinyPng().toString("base64")}` });
    const done = await request(app).put(`${BASE}/me/profile`).set(onboarding).send(body);
    expect(done.status).toBe(200);
    expect(done.body).not.toHaveProperty("nextStep");
  });

  it("an applicant who is already registered can change their password afterwards only with the old one", async () => {
    const email = "later@sust.edu";
    const { onboardingToken } = await registerAndVerify(email);
    const onboarding = bearerOf(onboardingToken);
    await request(app)
      .post(`${BASE}/me/signature`)
      .set(onboarding)
      .attach("file", tinyPng(), "s.png");
    await request(app).put(`${BASE}/me/profile`).set(onboarding).send({
      applicantProfile: "Officer",
      fullName: "Karim Mia",
      mobile: "01933333333",
      office: "Central Library",
      designation: "Assistant Librarian",
      password: PASSWORD,
    });
    const login = await request(app).post(`${BASE}/auth/login`).send({ email, password: PASSWORD });
    const session = bearerOf(login.body.accessToken);

    const viaProfile = await request(app)
      .put(`${BASE}/me/profile`)
      .set(session)
      .send({ fullName: "Karim Mia", mobile: "01933333333", password: "sneaky-new-password" });
    expect(viaProfile.status).toBe(422);

    const viaPassword = await request(app)
      .put(`${BASE}/me/password`)
      .set(session)
      .send({ currentPassword: PASSWORD, newPassword: "sneaky-new-password" });
    expect(viaPassword.status).toBe(204);
  });
});
