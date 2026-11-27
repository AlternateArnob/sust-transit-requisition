import cookieParser from "cookie-parser";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "../../src/config/env.js";
import {
  ACCESS_TTL_SECONDS,
  clearRefreshCookie,
  createRefreshToken,
  hashToken,
  ONBOARDING_TTL_SECONDS,
  parseTtlSeconds,
  readRefreshCookie,
  revokeAllForUser,
  revokeByToken,
  rotateRefreshToken,
  setRefreshCookie,
  signAccessToken,
  verifyAccessToken,
} from "../../src/services/tokens.js";
import { createUser } from "../helpers/factories.js";
import { db, truncateAll } from "../helpers/db.js";

beforeEach(truncateAll);
afterAll(() => db.destroy());

const NOW = new Date("2026-11-25T08:00:00.000Z");
const days = (base: Date, n: number) => new Date(base.getTime() + n * 86_400_000);

describe("parseTtlSeconds", () => {
  it.each([
    ["30s", 30],
    ["15m", 900],
    ["1h", 3600],
    ["7d", 604_800],
  ])("%s -> %i", (ttl, seconds) => expect(parseTtlSeconds(ttl)).toBe(seconds));

  it("rejects garbage", () => {
    expect(() => parseTtlSeconds("fifteen")).toThrow();
  });
});

describe("access tokens", () => {
  it("round-trips sub, role, scope and a unique jti", () => {
    const a = signAccessToken({ sub: "user-1", role: "Applicant", scope: "full" });
    const b = signAccessToken({ sub: "user-1", role: "Applicant", scope: "full" });

    expect(a.expiresIn).toBe(ACCESS_TTL_SECONDS);
    const claims = verifyAccessToken(a.token);
    expect(claims).toMatchObject({ sub: "user-1", role: "Applicant", scope: "full" });
    expect(claims.jti).not.toBe(verifyAccessToken(b.token).jti);
  });

  it("defaults to a 15 minute lifetime", () => {
    expect(ACCESS_TTL_SECONDS).toBe(900);
    const { token } = signAccessToken({ sub: "u", role: "Applicant", scope: "full" });
    const { iat, exp } = jwt.decode(token) as { iat: number; exp: number };
    expect(exp - iat).toBe(900);
  });

  it("gives onboarding tokens their own lifetime", () => {
    const { token, expiresIn } = signAccessToken({
      sub: "u",
      role: "Applicant",
      scope: "onboarding",
    });
    const { iat, exp } = jwt.decode(token) as { iat: number; exp: number };
    expect(expiresIn).toBe(ONBOARDING_TTL_SECONDS);
    expect(exp - iat).toBe(ONBOARDING_TTL_SECONDS);
    expect(verifyAccessToken(token).scope).toBe("onboarding");
  });

  it("rejects an expired token with 401", () => {
    const token = jwt.sign({ role: "Applicant", scope: "full" }, env.JWT_ACCESS_SECRET, {
      subject: "u",
      jwtid: "j",
      expiresIn: -10,
    });
    expect(() => verifyAccessToken(token)).toThrow(expect.objectContaining({ status: 401 }));
  });

  it("rejects a token signed with another secret", () => {
    const token = jwt.sign({ role: "Applicant", scope: "full" }, "x".repeat(40), {
      subject: "u",
      jwtid: "j",
    });
    expect(() => verifyAccessToken(token)).toThrow(expect.objectContaining({ status: 401 }));
  });

  it("rejects an unsigned (alg: none) token", () => {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const token = `${encode({ alg: "none", typ: "JWT" })}.${encode({
      sub: "u",
      role: "SuperAdmin",
      scope: "full",
      jti: "j",
    })}.`;
    expect(() => verifyAccessToken(token)).toThrow(expect.objectContaining({ status: 401 }));
  });

  it("rejects a token signed with a different HMAC algorithm", () => {
    const token = jwt.sign({ role: "Applicant", scope: "full" }, env.JWT_ACCESS_SECRET, {
      algorithm: "HS512",
      subject: "u",
      jwtid: "j",
    });
    expect(() => verifyAccessToken(token)).toThrow(expect.objectContaining({ status: 401 }));
  });

  it.each([
    ["missing scope", { role: "Applicant" }],
    ["unknown scope", { role: "Applicant", scope: "admin" }],
    ["unknown role", { role: "Root", scope: "full" }],
  ])("rejects a token with %s", (_name, payload) => {
    const token = jwt.sign(payload, env.JWT_ACCESS_SECRET, { subject: "u", jwtid: "j" });
    expect(() => verifyAccessToken(token)).toThrow(expect.objectContaining({ status: 401 }));
  });

  it("rejects garbage", () => {
    expect(() => verifyAccessToken("not.a.jwt")).toThrow(expect.objectContaining({ status: 401 }));
  });
});

describe("refresh tokens", () => {
  it("stores only the SHA-256 hash, never the token", async () => {
    const user = await createUser();
    const issued = await createRefreshToken(user.id as string, { userAgent: "UA", ip: "10.0.0.1" });
    const [row] = await db("refresh_tokens");

    expect(issued.token.length).toBeGreaterThanOrEqual(43); // 256 bits, base64url
    expect(row.token_hash).toBe(hashToken(issued.token));
    expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(issued.token);
    expect(row).toMatchObject({
      user_id: user.id,
      user_agent: "UA",
      ip: "10.0.0.1",
      revoked_at: null,
    });
  });

  it("expires after REFRESH_TOKEN_TTL_DAYS", async () => {
    const user = await createUser();
    const issued = await createRefreshToken(user.id as string, {}, { now: NOW });
    expect(issued.expiresAt).toEqual(days(NOW, env.REFRESH_TOKEN_TTL_DAYS));
  });

  it("rotates: the old token is revoked, the new one is in the same family", async () => {
    const user = await createUser();
    const first = await createRefreshToken(user.id as string);
    const second = await rotateRefreshToken(first.token);

    expect(second.token).not.toBe(first.token);
    expect(second.userId).toBe(user.id);
    expect(second.familyId).toBe(first.familyId);

    const old = await db("refresh_tokens").where({ id: first.id }).first();
    expect(old.revoked_at).not.toBeNull();
    expect(old.replaced_by).toBe(second.id);
    const current = await db("refresh_tokens").where({ id: second.id }).first();
    expect(current.revoked_at).toBeNull();
  });

  it("supports a chain of rotations", async () => {
    const user = await createUser();
    let token = (await createRefreshToken(user.id as string)).token;
    for (let i = 0; i < 4; i += 1) token = (await rotateRefreshToken(token)).token;
    expect(await db("refresh_tokens").whereNull("revoked_at")).toHaveLength(1);
  });

  it("rejects an unknown token", async () => {
    await expect(rotateRefreshToken("nope")).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
    });
  });

  it("rejects an expired token", async () => {
    const user = await createUser();
    const old = await createRefreshToken(
      user.id as string,
      {},
      { now: days(new Date(), -(env.REFRESH_TOKEN_TTL_DAYS + 1)) },
    );
    await expect(rotateRefreshToken(old.token)).rejects.toMatchObject({ status: 401 });
  });

  it("revokes the whole family when a revoked token is reused (theft detection)", async () => {
    const user = await createUser();
    const first = await createRefreshToken(user.id as string);
    const second = await rotateRefreshToken(first.token);

    // The attacker (or a stale tab) replays the first token.
    await expect(rotateRefreshToken(first.token)).rejects.toMatchObject({ status: 401 });

    // The revocation was committed even though the call threw ...
    expect(await db("refresh_tokens").whereNull("revoked_at")).toHaveLength(0);
    // ... so the legitimate holder of the newest token is logged out too.
    await expect(rotateRefreshToken(second.token)).rejects.toMatchObject({ status: 401 });
  });

  it("does not touch other sessions of the same user when one family is revoked", async () => {
    const user = await createUser();
    const laptop = await createRefreshToken(user.id as string);
    const phone = await createRefreshToken(user.id as string);
    await rotateRefreshToken(laptop.token);
    await expect(rotateRefreshToken(laptop.token)).rejects.toThrow();

    await expect(rotateRefreshToken(phone.token)).resolves.toMatchObject({ userId: user.id });
  });

  it("lets only one of two parallel rotations of the same token win", async () => {
    const user = await createUser();
    const { token } = await createRefreshToken(user.id as string);
    const results = await Promise.allSettled([
      rotateRefreshToken(token),
      rotateRefreshToken(token),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("revokeAllForUser revokes every live token of that user only", async () => {
    const user = await createUser();
    const other = await createUser();
    await createRefreshToken(user.id as string);
    await createRefreshToken(user.id as string);
    await createRefreshToken(other.id as string);

    expect(await revokeAllForUser(user.id as string)).toBe(2);
    expect(
      await db("refresh_tokens").where({ user_id: user.id }).whereNull("revoked_at"),
    ).toHaveLength(0);
    expect(
      await db("refresh_tokens").where({ user_id: other.id }).whereNull("revoked_at"),
    ).toHaveLength(1);
  });

  it("revokeByToken revokes the family and returns the owner", async () => {
    const user = await createUser();
    const first = await createRefreshToken(user.id as string);
    const second = await rotateRefreshToken(first.token);

    expect(await revokeByToken(second.token)).toBe(user.id);
    expect(await db("refresh_tokens").whereNull("revoked_at")).toHaveLength(0);
    await expect(rotateRefreshToken(second.token)).rejects.toMatchObject({ status: 401 });
  });

  it("revokeByToken returns null for an unknown token", async () => {
    expect(await revokeByToken("nope")).toBeNull();
  });

  it("deleting the user removes their refresh tokens (ON DELETE CASCADE)", async () => {
    const user = await createUser();
    await createRefreshToken(user.id as string);
    await db("users").where({ id: user.id }).delete();
    expect(await db("refresh_tokens")).toHaveLength(0);
  });
});

describe("refresh cookie helpers", () => {
  const app = express();
  app.use(cookieParser());
  app.get("/set", (_req, res) => {
    setRefreshCookie(res, "raw-token", new Date("2030-01-01T00:00:00Z"));
    res.end();
  });
  app.get("/clear", (_req, res) => {
    clearRefreshCookie(res);
    res.end();
  });
  app.get("/read", (req, res) => {
    res.json({ token: readRefreshCookie(req) });
  });

  it("sets an httpOnly cookie scoped to the auth path", async () => {
    const res = await request(app).get("/set");
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toContain(`${env.REFRESH_COOKIE_NAME}=raw-token`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain(`Path=${env.API_BASE_PATH}/auth`);
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Expires=Tue, 01 Jan 2030");
    expect(cookie.includes("Secure")).toBe(env.COOKIE_SECURE);
  });

  it("clears the cookie on the same path", async () => {
    const res = await request(app).get("/clear");
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toContain(`${env.REFRESH_COOKIE_NAME}=;`);
    expect(cookie).toContain(`Path=${env.API_BASE_PATH}/auth`);
  });

  it("reads the cookie back, or null when absent", async () => {
    const withCookie = await request(app)
      .get("/read")
      .set("Cookie", `${env.REFRESH_COOKIE_NAME}=abc`);
    expect(withCookie.body).toEqual({ token: "abc" });
    expect((await request(app).get("/read")).body).toEqual({ token: null });
  });
});
