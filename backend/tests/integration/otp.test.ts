import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "../../src/config/env.js";
import { withTransaction } from "../../src/db/transaction.js";
import {
  generateCode,
  issueOtp,
  otpFailureToError,
  OTP_MAX_SENDS_PER_WINDOW,
  verifyOtp,
} from "../../src/services/otp.js";
import { db, truncateAll } from "../helpers/db.js";

const EMAIL = "applicant@student.sust.edu";
const T0 = new Date("2026-11-25T08:00:00.000Z");
const after = (base: Date, seconds: number) => new Date(base.getTime() + seconds * 1000);

beforeEach(truncateAll);
afterAll(() => db.destroy());

const rows = () => db("otp_challenges").where({ email: EMAIL });

describe("generateCode", () => {
  it("returns OTP_LENGTH digits, zero-padded", () => {
    for (let i = 0; i < 200; i += 1) expect(generateCode()).toMatch(/^\d{6}$/);
    expect(generateCode(4)).toMatch(/^\d{4}$/);
  });
});

describe("issueOtp", () => {
  it("stores a salted hash, never the plain code", async () => {
    const issued = await issueOtp(EMAIL, "registration", { now: T0 });
    const [row] = await rows();

    expect(issued.code).toMatch(/^\d{6}$/);
    expect(row.code_hash).not.toContain(issued.code);
    expect(row.code_hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{64}$/);
    expect(row.attempts).toBe(0);
    expect(row.purpose).toBe("registration");
  });

  it("sets expiry to OTP_TTL_MINUTES and the resend time to the cooldown", async () => {
    const issued = await issueOtp(EMAIL, "registration", { now: T0 });
    expect(issued.expiresAt).toEqual(after(T0, env.OTP_TTL_MINUTES * 60));
    expect(issued.resendAvailableAt).toEqual(after(T0, env.OTP_RESEND_COOLDOWN_SECONDS));
  });

  it("uses different salts, so the same code hashes differently each time", async () => {
    await issueOtp(EMAIL, "registration", { now: T0 });
    const [first] = await rows();
    await issueOtp(EMAIL, "registration", { now: after(T0, 61) });
    const [second] = await rows();
    expect(first.code_hash.split(":")[0]).not.toBe(second.code_hash.split(":")[0]);
  });

  it("keeps one active challenge per email: a new request replaces the old code", async () => {
    const first = await issueOtp(EMAIL, "registration", { now: T0 });
    const second = await issueOtp(EMAIL, "registration", { now: after(T0, 61) });

    expect(await rows()).toHaveLength(1);
    if (first.code !== second.code) {
      expect(await verifyOtp(EMAIL, first.code, { now: after(T0, 62) })).toEqual({
        ok: false,
        reason: "wrong-code",
      });
    }
    expect(await verifyOtp(EMAIL, second.code, { now: after(T0, 63) })).toMatchObject({ ok: true });
  });

  it("resets the attempt counter when a new code is issued", async () => {
    await issueOtp(EMAIL, "registration", { now: T0 });
    await verifyOtp(EMAIL, "000000x", { now: after(T0, 1) });
    expect((await rows())[0].attempts).toBe(1);

    await issueOtp(EMAIL, "registration", { now: after(T0, 61) });
    expect((await rows())[0].attempts).toBe(0);
  });

  it("enforces the resend cooldown with retryAfterSeconds", async () => {
    await issueOtp(EMAIL, "registration", { now: T0 });
    await expect(issueOtp(EMAIL, "registration", { now: after(T0, 10) })).rejects.toMatchObject({
      status: 429,
      code: "RATE_LIMITED",
      details: { retryAfterSeconds: env.OTP_RESEND_COOLDOWN_SECONDS - 10 },
    });
    await expect(
      issueOtp(EMAIL, "registration", { now: after(T0, env.OTP_RESEND_COOLDOWN_SECONDS) }),
    ).resolves.toBeDefined();
  });

  it("does not replace the stored code when the cooldown rejects the request", async () => {
    const first = await issueOtp(EMAIL, "registration", { now: T0 });
    await expect(issueOtp(EMAIL, "registration", { now: after(T0, 5) })).rejects.toThrow();
    expect(await verifyOtp(EMAIL, first.code, { now: after(T0, 6) })).toMatchObject({ ok: true });
  });

  it("allows 5 sends per hour per email and blocks the 6th", async () => {
    for (let i = 0; i < OTP_MAX_SENDS_PER_WINDOW; i += 1) {
      await issueOtp(EMAIL, "registration", { now: after(T0, i * 61) });
    }
    const sixth = after(T0, OTP_MAX_SENDS_PER_WINDOW * 61);
    await expect(issueOtp(EMAIL, "registration", { now: sixth })).rejects.toMatchObject({
      status: 429,
      details: { retryAfterSeconds: expect.any(Number) },
    });
  });

  it("starts a new hourly window after an hour", async () => {
    for (let i = 0; i < OTP_MAX_SENDS_PER_WINDOW; i += 1) {
      await issueOtp(EMAIL, "registration", { now: after(T0, i * 61) });
    }
    await expect(
      issueOtp(EMAIL, "registration", { now: after(T0, 3601 + 5 * 61) }),
    ).resolves.toBeDefined();
    expect((await rows())[0].send_count).toBe(1);
  });

  it("counts sends per email, not globally", async () => {
    for (let i = 0; i < OTP_MAX_SENDS_PER_WINDOW; i += 1) {
      await issueOtp(EMAIL, "registration", { now: after(T0, i * 61) });
    }
    await expect(
      issueOtp("someone.else@sust.edu", "registration", { now: after(T0, 400) }),
    ).resolves.toBeDefined();
  });

  it("survives two parallel first requests for the same email", async () => {
    const results = await Promise.allSettled([
      issueOtp(EMAIL, "registration", { now: T0 }),
      issueOtp(EMAIL, "registration", { now: T0 }),
    ]);
    expect(await rows()).toHaveLength(1);
    // Exactly one wins; the other is held back by the cooldown, never a crash.
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected");
    expect(rejected).toMatchObject({ reason: { status: 429 } });
  });
});

describe("verifyOtp", () => {
  it("accepts the right code and deletes the challenge", async () => {
    const { code } = await issueOtp(EMAIL, "registration", { now: T0 });
    expect(await verifyOtp(EMAIL, code, { now: after(T0, 5) })).toEqual({
      ok: true,
      purpose: "registration",
    });
    expect(await rows()).toHaveLength(0);
  });

  it("cannot be used twice", async () => {
    const { code } = await issueOtp(EMAIL, "registration", { now: T0 });
    await verifyOtp(EMAIL, code, { now: after(T0, 5) });
    expect(await verifyOtp(EMAIL, code, { now: after(T0, 6) })).toEqual({
      ok: false,
      reason: "no-challenge",
    });
  });

  it("reports no-challenge when nothing was requested", async () => {
    expect(await verifyOtp(EMAIL, "123456")).toEqual({ ok: false, reason: "no-challenge" });
  });

  it("counts a wrong code as an attempt", async () => {
    const { code } = await issueOtp(EMAIL, "registration", { now: T0 });
    const wrong = code === "111111" ? "222222" : "111111";

    expect(await verifyOtp(EMAIL, wrong, { now: after(T0, 1) })).toEqual({
      ok: false,
      reason: "wrong-code",
    });
    expect((await rows())[0].attempts).toBe(1);
  });

  it("locks the challenge after OTP_MAX_ATTEMPTS wrong codes, even for the right code", async () => {
    const { code } = await issueOtp(EMAIL, "registration", { now: T0 });
    const wrong = code === "111111" ? "222222" : "111111";

    const reasons: string[] = [];
    for (let i = 0; i < env.OTP_MAX_ATTEMPTS; i += 1) {
      const result = await verifyOtp(EMAIL, wrong, { now: after(T0, 1 + i) });
      reasons.push(result.ok ? "ok" : result.reason);
    }
    expect(reasons.slice(0, -1).every((reason) => reason === "wrong-code")).toBe(true);
    expect(reasons.at(-1)).toBe("attempts-exceeded");

    expect(await verifyOtp(EMAIL, code, { now: after(T0, 30) })).toEqual({
      ok: false,
      reason: "attempts-exceeded",
    });
    expect(await rows()).toHaveLength(1);
  });

  it("lets the user recover from a lock by requesting a new code", async () => {
    await issueOtp(EMAIL, "registration", { now: T0 });
    for (let i = 0; i < env.OTP_MAX_ATTEMPTS; i += 1) {
      await verifyOtp(EMAIL, "not-a-code", { now: after(T0, 1 + i) });
    }
    const fresh = await issueOtp(EMAIL, "registration", { now: after(T0, 120) });
    expect(await verifyOtp(EMAIL, fresh.code, { now: after(T0, 121) })).toMatchObject({ ok: true });
  });

  it("rejects an expired code", async () => {
    const { code } = await issueOtp(EMAIL, "registration", { now: T0 });
    const late = after(T0, env.OTP_TTL_MINUTES * 60 + 1);
    expect(await verifyOtp(EMAIL, code, { now: late })).toEqual({ ok: false, reason: "expired" });
  });

  it("treats the exact expiry instant as expired", async () => {
    const { code, expiresAt } = await issueOtp(EMAIL, "registration", { now: T0 });
    expect(await verifyOtp(EMAIL, code, { now: expiresAt })).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("is bound to the email the code was issued for", async () => {
    const { code } = await issueOtp(EMAIL, "registration", { now: T0 });
    // Copy the stored hash onto another address: the code must not verify there.
    const [row] = await rows();
    await db("otp_challenges").insert({
      ...row,
      id: "00000000-0000-4000-8000-000000000001",
      email: "attacker@sust.edu",
    });
    expect(await verifyOtp("attacker@sust.edu", code, { now: after(T0, 1) })).toMatchObject({
      ok: false,
    });
  });

  it("commits the attempt counter even when called inside a surrounding transaction", async () => {
    const { code } = await issueOtp(EMAIL, "registration", { now: T0 });
    const wrong = code === "111111" ? "222222" : "111111";

    const result = await withTransaction((trx) =>
      verifyOtp(EMAIL, wrong, { trx, now: after(T0, 1) }),
    );
    expect(result).toMatchObject({ ok: false });
    expect((await rows())[0].attempts).toBe(1);
  });

  it("returns the purpose of the challenge", async () => {
    const { code } = await issueOtp(EMAIL, "resume", { now: T0 });
    expect(await verifyOtp(EMAIL, code, { now: after(T0, 1) })).toEqual({
      ok: true,
      purpose: "resume",
    });
  });
});

describe("otpFailureToError", () => {
  it.each([
    ["no-challenge", 422, "OTP_NOT_FOUND"],
    ["expired", 422, "OTP_EXPIRED"],
    ["wrong-code", 422, "OTP_INVALID"],
    ["attempts-exceeded", 429, "OTP_ATTEMPTS_EXCEEDED"],
  ] as const)("%s -> %i %s (Part 1 §8.2)", (reason, status, code) => {
    expect(otpFailureToError(reason)).toMatchObject({ status, code });
  });
});
