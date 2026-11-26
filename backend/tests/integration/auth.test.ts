import { randomUUID } from "node:crypto";
import type { Transporter } from "nodemailer";
import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { resetRateLimitStores } from "../../src/middleware/rateLimit.js";
import { setMailTransport } from "../../src/services/mailer.js";
import { hashPassword } from "../../src/services/password.js";
import { hashToken, signAccessToken, verifyAccessToken } from "../../src/services/tokens.js";
import { db, truncateAll } from "../helpers/db.js";
import { createUser } from "../helpers/factories.js";

const BASE = env.API_BASE_PATH;
const CSRF = { "X-Requested-With": "fetch" };
const PASSWORD = "correct-horse-battery";
const COOKIE_NAME = env.REFRESH_COOKIE_NAME;

// Each describe block builds its own app so it gets its own global rate-limit budget.
const buildApp = () => createApp();

// --- mail capture ---------------------------------------------------------------------------

interface SentMail {
  to: string;
  text: string;
}
const sent: SentMail[] = [];
const stubTransport = { sendMail: vi.fn() } as unknown as Transporter;
const sendMail = stubTransport.sendMail as unknown as ReturnType<typeof vi.fn>;

const codeOf = (mail: SentMail | undefined): string => {
  const match = /code is (\d+)/.exec(mail?.text ?? "");
  if (!match) throw new Error("No code in the captured email");
  return match[1] as string;
};
const lastCode = () => codeOf(sent.at(-1));

// --- helpers ---------------------------------------------------------------------------------

const post = (app: ReturnType<typeof buildApp>, path: string, body?: object, headers = {}) =>
  request(app)
    .post(`${BASE}${path}`)
    .set(headers)
    .send(body ?? {});

/** A user who can log in: verified, active, with a password. */
async function createLoginUser(overrides: Record<string, unknown> = {}) {
  return createUser({
    is_verified: 1,
    password_hash: await hashPassword(PASSWORD),
    full_name: "Test User",
    ...overrides,
  });
}

/** An applicant whose onboarding is finished (profile, signature and password). */
async function createCompleteApplicant(overrides: Record<string, unknown> = {}) {
  const user = await createLoginUser({
    applicant_profile: "Teacher",
    mobile: "01711111111",
    department: "Computer Science and Engineering",
    designation: "Professor",
    ...overrides,
  });
  const fileId = randomUUID();
  await db("files").insert({
    id: fileId,
    owner_user_id: user.id,
    purpose: "signature",
    original_name: "signature.png",
    mime_type: "image/png",
    size_bytes: 100,
    storage_name: `${fileId}.png`,
    sha256: "a".repeat(64),
  });
  await db("users").where({ id: user.id }).update({ signature_file_id: fileId });
  return { ...user, signature_file_id: fileId } as Record<string, unknown>;
}

const refreshCookie = (res: request.Response): string | undefined =>
  (res.headers["set-cookie"] as unknown as string[] | undefined)?.find((c) =>
    c.startsWith(`${COOKIE_NAME}=`),
  );
const cookieValue = (setCookie: string): string =>
  (setCookie.split(";")[0] ?? "").split("=")[1] ?? "";
const cookieHeader = (value: string) => ({ Cookie: `${COOKIE_NAME}=${value}`, ...CSRF });

/** Logs in over HTTP and returns what a browser would hold afterwards. */
async function loginAs(app: ReturnType<typeof buildApp>, email: string, password = PASSWORD) {
  const res = await post(app, "/auth/login", { email, password });
  expect(res.status).toBe(200);
  const setCookie = refreshCookie(res);
  expect(setCookie).toBeDefined();
  return {
    accessToken: res.body.accessToken as string,
    cookie: cookieValue(setCookie as string),
    body: res.body,
  };
}

/** Error bodies differ only by request id, which is unique per request. */
const withoutRequestId = (body: { error: Record<string, unknown> }) => ({
  error: { ...body.error, requestId: undefined },
});

beforeEach(async () => {
  await truncateAll();
  resetRateLimitStores();
  sent.length = 0;
  sendMail.mockReset();
  sendMail.mockImplementation(async (mail: SentMail) => {
    sent.push(mail);
    return {};
  });
  setMailTransport(stubTransport);
});

afterEach(() => {
  env.OTP_DEV_ECHO = true;
  env.OTP_RESEND_COOLDOWN_SECONDS = 60;
});

afterAll(async () => {
  setMailTransport(undefined);
  await db.destroy();
});

// =============================================================================================
// POST /auth/register
// =============================================================================================

describe("POST /auth/register", () => {
  const app = buildApp();

  it("creates an unverified applicant, stores a hashed code and emails it", async () => {
    const res = await post(app, "/auth/register", { email: "new.student@student.sust.edu" });

    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({
      email: "new.student@student.sust.edu",
      devCode: expect.stringMatching(/^\d{6}$/),
    });
    expect(new Date(res.body.otpExpiresAt).toISOString()).toBe(res.body.otpExpiresAt);
    expect(new Date(res.body.resendAvailableAt).getTime()).toBeGreaterThan(Date.now());

    const user = await db("users").where({ email: "new.student@student.sust.edu" }).first();
    expect(user).toMatchObject({ role: "Applicant", is_verified: 0, is_active: 1 });
    expect(user.password_hash).toBeNull();

    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe("new.student@student.sust.edu");
    expect(lastCode()).toBe(res.body.devCode);

    const challenge = await db("otp_challenges")
      .where({ email: "new.student@student.sust.edu" })
      .first();
    expect(challenge.code_hash).not.toContain(res.body.devCode);
    expect(challenge.purpose).toBe("registration");
  });

  it("lower-cases and trims the email", async () => {
    const res = await post(app, "/auth/register", { email: "  Mixed.Case@Student.SUST.edu " });
    expect(res.status).toBe(202);
    expect(res.body.email).toBe("mixed.case@student.sust.edu");
    expect(await db("users").where({ email: "mixed.case@student.sust.edu" })).toHaveLength(1);
  });

  it.each(["teacher@sust.edu", "student@student.sust.edu", "head@cse.sust.edu"])(
    "accepts %s",
    async (email) => {
      expect((await post(app, "/auth/register", { email })).status).toBe(202);
    },
  );

  it("rejects an email outside the SUST domains and creates nothing", async () => {
    const res = await post(app, "/auth/register", { email: "someone@gmail.com" });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({
      code: "EMAIL_DOMAIN_NOT_ALLOWED",
      message: "Use your SUST email address (e.g. name@student.sust.edu)",
      details: [{ path: "email" }],
    });
    expect(await db("users")).toHaveLength(0);
    expect(await db("otp_challenges")).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  it("rejects look-alike domains", async () => {
    for (const email of ["a@evilsust.edu", "a@sust.edu.evil.com", "a@sust.edu@evil.com"]) {
      const res = await post(app, "/auth/register", { email });
      expect([422]).toContain(res.status);
    }
    expect(await db("users")).toHaveLength(0);
  });

  it("returns 422 VALIDATION_ERROR for a malformed email, a missing email or an unknown key", async () => {
    const malformed = await post(app, "/auth/register", { email: "not-an-email" });
    expect(malformed.status).toBe(422);
    expect(malformed.body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      details: [{ path: "email" }],
    });

    expect((await post(app, "/auth/register", {})).body.error.code).toBe("VALIDATION_ERROR");

    const extra = await post(app, "/auth/register", { email: "a@sust.edu", role: "SuperAdmin" });
    expect(extra.status).toBe(422);
    expect(extra.body.error.details).toEqual([{ path: "role", message: "Unrecognized key" }]);
  });

  it("answers 409 EMAIL_TAKEN for a verified account and sends nothing", async () => {
    await createLoginUser({ email: "taken@sust.edu" });
    const res = await post(app, "/auth/register", { email: "taken@sust.edu" });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: "EMAIL_TAKEN",
      message: "This email is already registered. Try logging in instead.",
    });
    expect(sent).toHaveLength(0);
    expect(await db("otp_challenges")).toHaveLength(0);
  });

  it("re-registering an unverified email reuses the account and sends a new code", async () => {
    const first = await post(app, "/auth/register", { email: "again@sust.edu" });
    expect(first.status).toBe(202);

    // Inside the cooldown the second attempt is refused with a retry time.
    const tooSoon = await post(app, "/auth/register", { email: "again@sust.edu" });
    expect(tooSoon.status).toBe(429);
    expect(tooSoon.body.error).toMatchObject({
      code: "RATE_LIMITED",
      details: { retryAfterSeconds: expect.any(Number) },
    });

    await db("otp_challenges").update({ last_sent_at: new Date(Date.now() - 120_000) });
    const second = await post(app, "/auth/register", { email: "again@sust.edu" });
    expect(second.status).toBe(202);

    expect(await db("users").where({ email: "again@sust.edu" })).toHaveLength(1);
    expect(await db("otp_challenges").where({ email: "again@sust.edu" })).toHaveLength(1);
    expect(sent).toHaveLength(2);
    expect(lastCode()).toBe(second.body.devCode);
  });

  it("refuses a deactivated unverified account", async () => {
    await createUser({ email: "off@sust.edu", is_active: 0 });
    const res = await post(app, "/auth/register", { email: "off@sust.edu" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_DEACTIVATED");
    expect(sent).toHaveLength(0);
  });

  it("two parallel registrations create one account and one challenge", async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, () => post(app, "/auth/register", { email: "race@sust.edu" })),
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 202).length).toBeGreaterThanOrEqual(1);
    expect(statuses.every((s) => s === 202 || s === 429)).toBe(true);
    expect(await db("users").where({ email: "race@sust.edu" })).toHaveLength(1);
    expect(await db("otp_challenges").where({ email: "race@sust.edu" })).toHaveLength(1);
  });

  it("omits devCode when OTP_DEV_ECHO is off", async () => {
    env.OTP_DEV_ECHO = false;
    const res = await post(app, "/auth/register", { email: "nodev@sust.edu" });
    expect(res.status).toBe(202);
    expect(res.body).not.toHaveProperty("devCode");
    expect(JSON.stringify(res.body)).not.toContain(lastCode());
  });

  it("with echo off, a mail failure gives 502 and frees the user to retry at once", async () => {
    env.OTP_DEV_ECHO = false;
    sendMail.mockRejectedValueOnce(new Error("smtp down"));

    const failed = await post(app, "/auth/register", { email: "smtp@sust.edu" });
    expect(failed.status).toBe(502);
    expect(failed.body.error.code).toBe("EMAIL_DELIVERY_FAILED");
    expect(await db("otp_challenges")).toHaveLength(0); // no cooldown left behind

    const retry = await post(app, "/auth/register", { email: "smtp@sust.edu" });
    expect(retry.status).toBe(202);
  });

  it("with echo on (development), a mail failure is tolerated because the code is returned", async () => {
    sendMail.mockRejectedValueOnce(new Error("smtp down"));
    const res = await post(app, "/auth/register", { email: "devmail@sust.edu" });
    expect(res.status).toBe(202);
    expect(res.body.devCode).toMatch(/^\d{6}$/);
  });

  it("is rate limited per IP (10 an hour)", async () => {
    for (let i = 0; i < 10; i += 1) {
      expect((await post(app, "/auth/register", { email: `rl${i}@sust.edu` })).status).toBe(202);
    }
    const res = await post(app, "/auth/register", { email: "rl10@sust.edu" });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
  });
});

// =============================================================================================
// POST /auth/otp/verify
// =============================================================================================

describe("POST /auth/otp/verify", () => {
  const app = buildApp();

  async function registered(email = "verify@sust.edu") {
    const res = await post(app, "/auth/register", { email });
    return { email, code: res.body.devCode as string };
  }

  it("verifies the account and returns an onboarding token plus the public user", async () => {
    const { email, code } = await registered();
    const res = await post(app, "/auth/otp/verify", { email, code });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email, role: "Applicant", isVerified: true });
    expect(res.body.user).not.toHaveProperty("passwordHash");
    expect(JSON.stringify(res.body)).not.toMatch(/password_hash|passwordHash|argon2/);

    expect(verifyAccessToken(res.body.onboardingToken)).toMatchObject({
      sub: res.body.user.id,
      role: "Applicant",
      scope: "onboarding",
    });
    expect((await db("users").where({ email }).first()).is_verified).toBe(1);
    expect(await db("otp_challenges").where({ email })).toHaveLength(0);
    expect(res.headers["set-cookie"]).toBeUndefined(); // no session yet
  });

  it("the onboarding token lets the user ask for their next step", async () => {
    const { email, code } = await registered();
    const verified = await post(app, "/auth/otp/verify", { email, code });

    const me = await request(app)
      .get(`${BASE}/auth/me`)
      .set("Authorization", `Bearer ${verified.body.onboardingToken}`);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ email, nextStep: "profile-setup", hasSignature: false });
  });

  it("accepts the code with surrounding spaces and an upper-case email", async () => {
    const { email, code } = await registered();
    const res = await post(app, "/auth/otp/verify", {
      email: email.toUpperCase(),
      code: ` ${code} `,
    });
    expect(res.status).toBe(200);
  });

  it("a code can only be used once", async () => {
    const { email, code } = await registered();
    expect((await post(app, "/auth/otp/verify", { email, code })).status).toBe(200);

    const replay = await post(app, "/auth/otp/verify", { email, code });
    expect(replay.status).toBe(422);
    expect(replay.body.error.code).toBe("OTP_NOT_FOUND");
  });

  it("a wrong code gives 422 OTP_INVALID and costs one attempt", async () => {
    const { email, code } = await registered();
    const wrong = code === "000000" ? "111111" : "000000";

    const res = await post(app, "/auth/otp/verify", { email, code: wrong });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("OTP_INVALID");
    expect((await db("otp_challenges").where({ email }).first()).attempts).toBe(1);
    expect((await db("users").where({ email }).first()).is_verified).toBe(0);
  });

  it("five wrong codes lock the challenge, even against the right code", async () => {
    const { email, code } = await registered();
    const wrong = code === "000000" ? "111111" : "000000";

    const statuses: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      statuses.push((await post(app, "/auth/otp/verify", { email, code: wrong })).status);
    }
    expect(statuses).toEqual([422, 422, 422, 422, 429]);

    const locked = await post(app, "/auth/otp/verify", { email, code });
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe("OTP_ATTEMPTS_EXCEEDED");
    expect((await db("users").where({ email }).first()).is_verified).toBe(0);
  });

  it("an expired code gives 422 OTP_EXPIRED", async () => {
    const { email, code } = await registered();
    await db("otp_challenges").update({ expires_at: new Date(Date.now() - 1000) });

    const res = await post(app, "/auth/otp/verify", { email, code });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("OTP_EXPIRED");
  });

  it("no challenge, or an unknown email, gives the same 422 OTP_NOT_FOUND", async () => {
    const unknown = await post(app, "/auth/otp/verify", {
      email: "ghost@sust.edu",
      code: "123456",
    });
    expect(unknown.status).toBe(422);
    expect(unknown.body.error.code).toBe("OTP_NOT_FOUND");

    await createUser({ email: "nochallenge@sust.edu" });
    const none = await post(app, "/auth/otp/verify", {
      email: "nochallenge@sust.edu",
      code: "123456",
    });
    expect(withoutRequestId(none.body)).toEqual(withoutRequestId(unknown.body));
  });

  it("a code that is not six digits is a validation error and costs no attempt", async () => {
    const { email } = await registered();
    for (const code of ["12345", "1234567", "abcdef", "12 456", ""]) {
      const res = await post(app, "/auth/otp/verify", { email, code });
      expect(res.status).toBe(422);
      expect(res.body.error).toMatchObject({
        code: "VALIDATION_ERROR",
        details: [{ path: "code" }],
      });
    }
    expect((await db("otp_challenges").where({ email }).first()).attempts).toBe(0);
  });

  it("rejects unknown keys and a missing email", async () => {
    expect((await post(app, "/auth/otp/verify", { code: "123456" })).status).toBe(422);
    const extra = await post(app, "/auth/otp/verify", {
      email: "a@sust.edu",
      code: "123456",
      x: 1,
    });
    expect(extra.status).toBe(422);
  });

  it("refuses a deactivated account and does not verify it", async () => {
    const { email, code } = await registered();
    await db("users").where({ email }).update({ is_active: 0 });

    const res = await post(app, "/auth/otp/verify", { email, code });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_DEACTIVATED");
    expect((await db("users").where({ email }).first()).is_verified).toBe(0);
  });

  it("a code for an address with no account is rejected and cleaned up", async () => {
    // Left over from an account that was deleted after the code was issued.
    const issued = await post(app, "/auth/register", { email: "gone@sust.edu" });
    await db("users").where({ email: "gone@sust.edu" }).delete();

    const res = await post(app, "/auth/otp/verify", {
      email: "gone@sust.edu",
      code: issued.body.devCode,
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("OTP_NOT_FOUND");
  });

  it("is rate limited per IP (20 per 15 minutes)", async () => {
    for (let i = 0; i < 20; i += 1) {
      await post(app, "/auth/otp/verify", { email: "x@sust.edu", code: "123456" });
    }
    const res = await post(app, "/auth/otp/verify", { email: "x@sust.edu", code: "123456" });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
  });
});

// =============================================================================================
// POST /auth/otp/resend
// =============================================================================================

describe("POST /auth/otp/resend", () => {
  const app = buildApp();

  it("replaces the code after the cooldown; the old code stops working", async () => {
    const first = await post(app, "/auth/register", { email: "resend@sust.edu" });
    await db("otp_challenges").update({ last_sent_at: new Date(Date.now() - 120_000) });

    const res = await post(app, "/auth/otp/resend", { email: "resend@sust.edu" });
    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({ email: "resend@sust.edu", devCode: expect.any(String) });
    expect(sent).toHaveLength(2);

    if (res.body.devCode !== first.body.devCode) {
      const old = await post(app, "/auth/otp/verify", {
        email: "resend@sust.edu",
        code: first.body.devCode,
      });
      expect(old.body.error.code).toBe("OTP_INVALID");
    }
    const fresh = await post(app, "/auth/otp/verify", {
      email: "resend@sust.edu",
      code: res.body.devCode,
    });
    expect(fresh.status).toBe(200);
  });

  it("inside the cooldown returns 429 RATE_LIMITED with retryAfterSeconds", async () => {
    await post(app, "/auth/register", { email: "cool@sust.edu" });
    const res = await post(app, "/auth/otp/resend", { email: "cool@sust.edu" });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
    expect(res.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
    expect(res.body.error.details.retryAfterSeconds).toBeLessThanOrEqual(60);
    expect(sent).toHaveLength(1);
  });

  it("answers an unknown email like a real one, but sends nothing", async () => {
    const res = await post(app, "/auth/otp/resend", { email: "nobody@sust.edu" });
    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({ email: "nobody@sust.edu" });
    expect(res.body).not.toHaveProperty("devCode");
    expect(sent).toHaveLength(0);
    expect(await db("otp_challenges")).toHaveLength(0);
    expect(await db("users")).toHaveLength(0);
  });

  it("does not email the owner of an already verified account", async () => {
    await createLoginUser({ email: "active@sust.edu" });
    const res = await post(app, "/auth/otp/resend", { email: "active@sust.edu" });
    expect(res.status).toBe(202);
    expect(res.body).not.toHaveProperty("devCode");
    expect(sent).toHaveLength(0);
    expect(await db("otp_challenges")).toHaveLength(0);
  });

  it("validates the body", async () => {
    expect((await post(app, "/auth/otp/resend", {})).status).toBe(422);
    expect((await post(app, "/auth/otp/resend", { email: "a@sust.edu", code: "1" })).status).toBe(
      422,
    );
  });
});

// =============================================================================================
// POST /auth/login
// =============================================================================================

describe("POST /auth/login", () => {
  const app = buildApp();

  it("logs in: access token, refresh cookie and the public user", async () => {
    const user = await createCompleteApplicant({ email: "login@sust.edu" });
    const res = await post(app, "/auth/login", { email: "login@sust.edu", password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      accessToken: expect.any(String),
      expiresIn: 900,
      user: { id: user.id, email: "login@sust.edu", role: "Applicant", hasSignature: true },
    });
    expect(verifyAccessToken(res.body.accessToken)).toMatchObject({ sub: user.id, scope: "full" });
    expect(JSON.stringify(res.body)).not.toMatch(/password_hash|passwordHash|argon2/);

    const cookie = refreshCookie(res) as string;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toContain(`Path=${BASE}/auth`);
    expect(cookie).toMatch(/Expires=/);

    // Only the hash of the cookie value is stored.
    const raw = cookieValue(cookie);
    const [row] = await db("refresh_tokens").where({ user_id: user.id });
    expect(row.token_hash).toBe(hashToken(raw));
    expect(row.token_hash).not.toBe(raw);
    expect(row.revoked_at).toBeNull();
  });

  it("stamps last_login_at and clears the failure counter", async () => {
    const user = await createLoginUser({ email: "stamp@sust.edu", failed_login_count: 3 });
    await post(app, "/auth/login", { email: "stamp@sust.edu", password: PASSWORD });

    const row = await db("users").where({ id: user.id }).first();
    expect(row.failed_login_count).toBe(0);
    expect(row.locked_until).toBeNull();
    expect(row.last_login_at).not.toBeNull();
  });

  it("matches the email case-insensitively", async () => {
    await createLoginUser({ email: "case@sust.edu" });
    const res = await post(app, "/auth/login", { email: "  CASE@Sust.EDU ", password: PASSWORD });
    expect(res.status).toBe(200);
  });

  it("gives the same 401 for an unknown email and a wrong password", async () => {
    await createLoginUser({ email: "real@sust.edu" });

    const unknown = await post(app, "/auth/login", {
      email: "ghost@sust.edu",
      password: "whatever-1",
    });
    const wrong = await post(app, "/auth/login", {
      email: "real@sust.edu",
      password: "whatever-1",
    });

    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(withoutRequestId(unknown.body)).toEqual(withoutRequestId(wrong.body));
    expect(refreshCookie(unknown)).toBeUndefined();
    expect(refreshCookie(wrong)).toBeUndefined();
  });

  it("locks the account for 15 minutes after 5 consecutive wrong passwords", async () => {
    const user = await createLoginUser({ email: "lock@sust.edu" });

    for (let i = 0; i < 5; i += 1) {
      const res = await post(app, "/auth/login", {
        email: "lock@sust.edu",
        password: "wrong-pass-1",
      });
      expect(res.status).toBe(401);
    }

    const row = await db("users").where({ id: user.id }).first();
    const lockedFor = new Date(`${row.locked_until.replace(" ", "T")}Z`).getTime() - Date.now();
    expect(lockedFor).toBeGreaterThan(14 * 60_000);
    expect(lockedFor).toBeLessThanOrEqual(15 * 60_000 + 1000);
    expect(row.failed_login_count).toBe(0);

    // Even the right password is refused while locked, and no session is created.
    const locked = await post(app, "/auth/login", { email: "lock@sust.edu", password: PASSWORD });
    expect(locked.status).toBe(429);
    expect(locked.body.error).toMatchObject({
      code: "RATE_LIMITED",
      details: { retryAfterSeconds: expect.any(Number) },
    });
    expect(locked.body.error.details.retryAfterSeconds).toBeGreaterThan(14 * 60);
    expect(refreshCookie(locked)).toBeUndefined();
    expect(await db("refresh_tokens")).toHaveLength(0);
  });

  it("works again once the lock has expired, and a new lock needs five new failures", async () => {
    await createLoginUser({ email: "expire@sust.edu" });
    for (let i = 0; i < 5; i += 1) {
      await post(app, "/auth/login", { email: "expire@sust.edu", password: "wrong-pass-1" });
    }
    await db("users").update({ locked_until: new Date(Date.now() - 1000) });

    // One wrong guess after the lock does not re-lock immediately.
    expect(
      (await post(app, "/auth/login", { email: "expire@sust.edu", password: "wrong-pass-1" }))
        .status,
    ).toBe(401);
    expect(
      (await post(app, "/auth/login", { email: "expire@sust.edu", password: PASSWORD })).status,
    ).toBe(200);
  });

  it("a successful login resets the counter, so failures must be consecutive", async () => {
    await createLoginUser({ email: "consec@sust.edu" });
    const attempt = (password: string) =>
      post(app, "/auth/login", { email: "consec@sust.edu", password });

    for (let i = 0; i < 4; i += 1) expect((await attempt("wrong-pass-1")).status).toBe(401);
    expect((await attempt(PASSWORD)).status).toBe(200);
    for (let i = 0; i < 4; i += 1) expect((await attempt("wrong-pass-1")).status).toBe(401);

    expect((await attempt(PASSWORD)).status).toBe(200); // never locked
  });

  it("refuses a deactivated account with 403 ACCOUNT_DEACTIVATED, even with the right password", async () => {
    await createLoginUser({ email: "deact@sust.edu", is_active: 0 });
    const res = await post(app, "/auth/login", { email: "deact@sust.edu", password: PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_DEACTIVATED");
    expect(refreshCookie(res)).toBeUndefined();
  });

  describe("accounts that cannot log in yet", () => {
    it("unverified: emails a new code and says nextStep otp, with NO token and no user data", async () => {
      await createUser({ email: "unverified@sust.edu", full_name: "Private Name", mobile: "017" });
      const res = await post(app, "/auth/login", {
        email: "unverified@sust.edu",
        password: "anything-1",
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        nextStep: "otp",
        email: "unverified@sust.edu",
        otpExpiresAt: expect.any(String),
        resendAvailableAt: expect.any(String),
        devCode: expect.stringMatching(/^\d{6}$/),
      });
      // The plan handed an onboarding token out here; that would let anyone take over the account.
      expect(res.body).not.toHaveProperty("onboardingToken");
      expect(res.body).not.toHaveProperty("accessToken");
      expect(res.body).not.toHaveProperty("user");
      expect(JSON.stringify(res.body)).not.toContain("Private Name");
      expect(refreshCookie(res)).toBeUndefined();

      expect(sent).toHaveLength(1);
      expect(lastCode()).toBe(res.body.devCode);
      expect((await db("otp_challenges").first()).purpose).toBe("registration");
    });

    it("verified but no password yet: nextStep otp with a 'resume' code, no token", async () => {
      await createUser({ email: "nopass@sust.edu", is_verified: 1, full_name: "Imported User" });
      const res = await post(app, "/auth/login", {
        email: "nopass@sust.edu",
        password: "anything-1",
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ nextStep: "otp", email: "nopass@sust.edu" });
      expect(res.body).not.toHaveProperty("onboardingToken");
      expect(res.body).not.toHaveProperty("user");
      expect((await db("otp_challenges").first()).purpose).toBe("resume");
      expect(sent).toHaveLength(1);
    });

    it("the owner finishes through /otp/verify, which is what issues the onboarding token", async () => {
      await createUser({ email: "resume@sust.edu", is_verified: 1 });
      const login = await post(app, "/auth/login", {
        email: "resume@sust.edu",
        password: "anything-1",
      });
      const verified = await post(app, "/auth/otp/verify", {
        email: "resume@sust.edu",
        code: login.body.devCode,
      });

      expect(verified.status).toBe(200);
      expect(verifyAccessToken(verified.body.onboardingToken).scope).toBe("onboarding");
    });

    it("asking again inside the cooldown is a 429 with a retry time", async () => {
      await createUser({ email: "twice@sust.edu" });
      expect(
        (await post(app, "/auth/login", { email: "twice@sust.edu", password: "x-pass-1" })).status,
      ).toBe(200);

      const again = await post(app, "/auth/login", {
        email: "twice@sust.edu",
        password: "x-pass-1",
      });
      expect(again.status).toBe(429);
      expect(again.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
      expect(sent).toHaveLength(1);
    });

    it("with echo off the code travels by email only", async () => {
      env.OTP_DEV_ECHO = false;
      await createUser({ email: "echooff@sust.edu" });
      const res = await post(app, "/auth/login", {
        email: "echooff@sust.edu",
        password: "x-pass-1",
      });
      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty("devCode");
      expect(sent).toHaveLength(1);
    });
  });

  it("validates the body: missing fields, unknown keys, over-long password", async () => {
    expect((await post(app, "/auth/login", { email: "a@sust.edu" })).body.error.details).toEqual([
      { path: "password", message: expect.any(String) },
    ]);
    expect((await post(app, "/auth/login", { password: "x" })).status).toBe(422);
    expect(
      (await post(app, "/auth/login", { email: "a@sust.edu", password: "x", remember: true }))
        .status,
    ).toBe(422);
    const long = await post(app, "/auth/login", { email: "a@sust.edu", password: "p".repeat(500) });
    expect(long.status).toBe(422);
    expect(long.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("is rate limited to 10 attempts per IP and email, and other emails are unaffected", async () => {
    for (let i = 0; i < 10; i += 1) {
      expect(
        (await post(app, "/auth/login", { email: "spam@sust.edu", password: "wrong-pass-1" }))
          .status,
      ).toBe(401);
    }
    const blocked = await post(app, "/auth/login", {
      email: "spam@sust.edu",
      password: "wrong-pass-1",
    });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatchObject({
      code: "RATE_LIMITED",
      message: "Too many login attempts. Please try again later.",
    });

    const other = await post(app, "/auth/login", {
      email: "other@sust.edu",
      password: "wrong-pass-1",
    });
    expect(other.status).toBe(401);
  });
});

// =============================================================================================
// POST /auth/refresh
// =============================================================================================

describe("POST /auth/refresh", () => {
  const app = buildApp();
  const refresh = (headers: Record<string, string>) =>
    request(app).post(`${BASE}/auth/refresh`).set(headers);

  it("requires the X-Requested-With header", async () => {
    await createLoginUser({ email: "csrf@sust.edu" });
    const { cookie } = await loginAs(app, "csrf@sust.edu");

    const res = await refresh({ Cookie: `${COOKIE_NAME}=${cookie}` });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");

    const wrong = await refresh({
      Cookie: `${COOKIE_NAME}=${cookie}`,
      "X-Requested-With": "XMLHttpRequest",
    });
    expect(wrong.status).toBe(403);

    // The refused call did not use up the token.
    expect((await refresh(cookieHeader(cookie))).status).toBe(200);
  });

  it("returns 401 UNAUTHENTICATED without a cookie", async () => {
    const res = await refresh(CSRF);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("rotates: new access token, new cookie, old token revoked in the same family", async () => {
    const user = await createCompleteApplicant({ email: "rotate@sust.edu" });
    const first = await loginAs(app, "rotate@sust.edu");

    const res = await refresh(cookieHeader(first.cookie));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ expiresIn: 900, user: { id: user.id, role: "Applicant" } });
    expect(verifyAccessToken(res.body.accessToken)).toMatchObject({ sub: user.id, scope: "full" });

    const newCookie = cookieValue(refreshCookie(res) as string);
    expect(newCookie).not.toBe(first.cookie);

    const rows = await db("refresh_tokens").where({ user_id: user.id }).orderBy("created_at");
    expect(rows).toHaveLength(2);
    expect(rows[0].family_id).toBe(rows[1].family_id);
    expect(rows[0].revoked_at).not.toBeNull();
    expect(rows[0].replaced_by).toBe(rows[1].id);
    expect(rows[1].revoked_at).toBeNull();
    expect(rows[1].token_hash).toBe(hashToken(newCookie));

    // The new cookie keeps working.
    expect((await refresh(cookieHeader(newCookie))).status).toBe(200);
  });

  it("reusing an old token revokes the whole family, including the newest token", async () => {
    await createLoginUser({ email: "reuse@sust.edu" });
    const first = await loginAs(app, "reuse@sust.edu");
    const second = await refresh(cookieHeader(first.cookie));
    const newest = cookieValue(refreshCookie(second) as string);

    const replay = await refresh(cookieHeader(first.cookie));
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe("UNAUTHENTICATED");

    const afterTheft = await refresh(cookieHeader(newest));
    expect(afterTheft.status).toBe(401);
    expect(await db("refresh_tokens").whereNull("revoked_at")).toHaveLength(0);
  });

  it("a failed refresh clears the cookie", async () => {
    const res = await refresh(cookieHeader("not-a-real-token"));
    expect(res.status).toBe(401);
    const cleared = refreshCookie(res) as string;
    expect(cleared).toMatch(new RegExp(`^${COOKIE_NAME}=;`));
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it("an expired refresh token is refused", async () => {
    await createLoginUser({ email: "old@sust.edu" });
    const { cookie } = await loginAs(app, "old@sust.edu");
    await db("refresh_tokens").update({ expires_at: new Date(Date.now() - 1000) });

    expect((await refresh(cookieHeader(cookie))).status).toBe(401);
  });

  it("a deactivated user gets 403 and every refresh token is revoked", async () => {
    const user = await createLoginUser({ email: "gone@sust.edu" });
    const a = await loginAs(app, "gone@sust.edu");
    await loginAs(app, "gone@sust.edu"); // a second browser
    await db("users").where({ id: user.id }).update({ is_active: 0 });

    const res = await refresh(cookieHeader(a.cookie));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_DEACTIVATED");
    expect(
      await db("refresh_tokens").where({ user_id: user.id }).whereNull("revoked_at"),
    ).toHaveLength(0);
  });

  it("a deleted-then-unverified account cannot refresh", async () => {
    const user = await createLoginUser({ email: "unver@sust.edu" });
    const { cookie } = await loginAs(app, "unver@sust.edu");
    await db("users").where({ id: user.id }).update({ is_verified: 0 });

    expect((await refresh(cookieHeader(cookie))).status).toBe(401);
    expect(
      await db("refresh_tokens").where({ user_id: user.id }).whereNull("revoked_at"),
    ).toHaveLength(0);
  });

  it("reads the role from the database, not from an old session", async () => {
    const user = await createLoginUser({ email: "promo@sust.edu" });
    const { cookie } = await loginAs(app, "promo@sust.edu");
    await db("users").where({ id: user.id }).update({ role: "TransportInCharge" });

    const res = await refresh(cookieHeader(cookie));
    expect(res.body.user.role).toBe("TransportInCharge");
    expect(verifyAccessToken(res.body.accessToken).role).toBe("TransportInCharge");
  });
});

// =============================================================================================
// POST /auth/logout
// =============================================================================================

describe("POST /auth/logout", () => {
  const app = buildApp();
  const logout = (headers: Record<string, string>) =>
    request(app).post(`${BASE}/auth/logout`).set(headers);
  const refresh = (headers: Record<string, string>) =>
    request(app).post(`${BASE}/auth/refresh`).set(headers);

  it("requires the X-Requested-With header", async () => {
    await createLoginUser({ email: "lo-csrf@sust.edu" });
    const { cookie } = await loginAs(app, "lo-csrf@sust.edu");

    const res = await logout({ Cookie: `${COOKIE_NAME}=${cookie}` });
    expect(res.status).toBe(403);
    expect(await db("refresh_tokens").whereNull("revoked_at")).toHaveLength(1);
  });

  it("revokes the refresh token, clears the cookie and answers 204", async () => {
    await createLoginUser({ email: "lo@sust.edu" });
    const { cookie } = await loginAs(app, "lo@sust.edu");

    const res = await logout(cookieHeader(cookie));
    expect(res.status).toBe(204);
    expect(res.text).toBe("");
    expect(refreshCookie(res)).toMatch(new RegExp(`^${COOKIE_NAME}=;`));

    const after = await refresh(cookieHeader(cookie));
    expect(after.status).toBe(401);
  });

  it("works without a cookie (already logged out) and without a bearer token", async () => {
    const res = await logout(CSRF);
    expect(res.status).toBe(204);
  });

  it("ignores a garbage cookie", async () => {
    const res = await logout(cookieHeader("garbage"));
    expect(res.status).toBe(204);
  });

  it("only ends this browser's session; another login stays valid", async () => {
    await createLoginUser({ email: "two@sust.edu" });
    const laptop = await loginAs(app, "two@sust.edu");
    const phone = await loginAs(app, "two@sust.edu");

    expect((await logout(cookieHeader(laptop.cookie))).status).toBe(204);

    expect((await refresh(cookieHeader(laptop.cookie))).status).toBe(401);
    expect((await refresh(cookieHeader(phone.cookie))).status).toBe(200);
  });
});

// =============================================================================================
// GET /auth/me
// =============================================================================================

describe("GET /auth/me", () => {
  const app = buildApp();
  const me = (token?: string) =>
    request(app)
      .get(`${BASE}/auth/me`)
      .set(token ? { Authorization: `Bearer ${token}` } : {});
  const tokenFor = (user: Record<string, unknown>, scope: "full" | "onboarding" = "full") =>
    signAccessToken({ sub: user.id as string, role: user.role as never, scope }).token;

  it("returns 401 without a token", async () => {
    const res = await me();
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns the public user, with no nextStep once onboarding is finished", async () => {
    const user = await createCompleteApplicant({ email: "done@sust.edu" });
    const res = await me(tokenFor(user));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: user.id,
      email: "done@sust.edu",
      role: "Applicant",
      applicantProfile: "Teacher",
      fullName: "Test User",
      department: "Computer Science and Engineering",
      hasSignature: true,
      signatureUrl: `${BASE}/files/${user.signature_file_id}`,
      isVerified: true,
      isActive: true,
    });
    expect(res.body).not.toHaveProperty("nextStep");
    expect(JSON.stringify(res.body)).not.toMatch(
      /password_hash|passwordHash|argon2|signatureFileId/,
    );
  });

  it('says nextStep "profile-setup" for a verified applicant who has not finished the profile', async () => {
    const user = await createUser({ email: "half@sust.edu", is_verified: 1 });
    const res = await me(tokenFor(user, "onboarding"));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ nextStep: "profile-setup", hasSignature: false });
  });

  it('a password-less verified account with everything else filled in still needs "profile-setup"', async () => {
    const user = await createCompleteApplicant({ email: "nopw@sust.edu", password_hash: null });
    expect((await me(tokenFor(user, "onboarding"))).body.nextStep).toBe("profile-setup");
  });

  it("accepts an onboarding token", async () => {
    const user = await createUser({ email: "onb@sust.edu", is_verified: 1 });
    expect((await me(tokenFor(user, "onboarding"))).status).toBe(200);
  });

  it("a Transport Office account needs nothing more", async () => {
    const user = await createLoginUser({ email: "tic@sust.edu", role: "TransportInCharge" });
    const res = await me(tokenFor(user));
    expect(res.body).toMatchObject({ role: "TransportInCharge", hasSignature: false });
    expect(res.body).not.toHaveProperty("nextStep");
  });

  it("uses the role stored in the database, not the one inside the token", async () => {
    const user = await createLoginUser({ email: "role@sust.edu" });
    const token = tokenFor(user);
    await db("users")
      .where({ id: user.id })
      .update({ role: "DepartmentHead", head_of_department: "Physics" });

    const res = await me(token);
    expect(res.body).toMatchObject({ role: "DepartmentHead", headOfDepartment: "Physics" });
  });

  it("refuses a deactivated user on the very next request", async () => {
    const user = await createLoginUser({ email: "deact-me@sust.edu" });
    const token = tokenFor(user);
    expect((await me(token)).status).toBe(200);

    await db("users").where({ id: user.id }).update({ is_active: 0 });
    const res = await me(token);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_DEACTIVATED");
  });
});

// =============================================================================================
// The whole journey
// =============================================================================================

describe("register -> verify -> login journey", () => {
  const app = buildApp();

  it("an applicant registers and verifies; they cannot log in until a password exists (Step 6)", async () => {
    const reg = await post(app, "/auth/register", { email: "journey@student.sust.edu" });
    const verified = await post(app, "/auth/otp/verify", {
      email: "journey@student.sust.edu",
      code: reg.body.devCode,
    });
    expect(verified.status).toBe(200);

    // Profile setup (Step 6) is what stores the password. Until then login starts a new code.
    const early = await post(app, "/auth/login", {
      email: "journey@student.sust.edu",
      password: "My-new-pass-1",
    });
    expect(early.status).toBe(200);
    expect(early.body.nextStep).toBe("otp");
    expect(early.body).not.toHaveProperty("accessToken");

    // Simulate Step 6 finishing the account, then log in for real.
    await db("users")
      .where({ email: "journey@student.sust.edu" })
      .update({ password_hash: await hashPassword("My-new-pass-1") });
    const login = await post(app, "/auth/login", {
      email: "journey@student.sust.edu",
      password: "My-new-pass-1",
    });
    expect(login.status).toBe(200);
    expect(login.body.user.email).toBe("journey@student.sust.edu");
  });
});
