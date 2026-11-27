import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { UserRole } from "../../src/config/constants.js";
import { env } from "../../src/config/env.js";
import { canManageUserAccounts } from "../../src/domain/permissions.js";
import { authenticate, requireCapability, requireRole } from "../../src/middleware/auth.js";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import {
  loginLimiter,
  otpLimiter,
  registerLimiter,
  resetRateLimitStores,
} from "../../src/middleware/rateLimit.js";
import { requestId } from "../../src/middleware/requestId.js";
import { signAccessToken } from "../../src/services/tokens.js";
import { db, truncateAll } from "../helpers/db.js";
import { createUser } from "../helpers/factories.js";

function buildApp() {
  const app = express();
  app.use(requestId);
  app.use(express.json());
  app.get("/full", authenticate(), (req, res) => {
    res.json({ id: req.user?.id, role: req.user?.role, scope: req.user?.scope });
  });
  app.get("/onboarding-ok", authenticate({ allowOnboarding: true }), (req, res) => {
    res.json({ scope: req.user?.scope });
  });
  app.get("/super", authenticate(), requireRole("SuperAdmin"), (_req, res) => {
    res.json({ ok: true });
  });
  app.get("/capability", authenticate(), requireCapability(canManageUserAccounts), (_req, res) => {
    res.json({ ok: true });
  });
  app.get("/no-auth-role", requireRole("SuperAdmin"), (_req, res) => {
    res.json({ ok: true });
  });
  app.post("/login", loginLimiter, (_req, res) => {
    res.json({ ok: true });
  });
  app.post("/register", registerLimiter, (_req, res) => {
    res.json({ ok: true });
  });
  app.post("/otp", otpLimiter, (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

const app = buildApp();
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const tokenFor = (user: Record<string, unknown>, scope: "full" | "onboarding" = "full") =>
  signAccessToken({ sub: user.id as string, role: user.role as UserRole, scope }).token;
const verified = (overrides = {}) => createUser({ is_verified: 1, ...overrides });

beforeEach(async () => {
  await truncateAll();
  resetRateLimitStores();
});
afterAll(() => db.destroy());

describe("authenticate()", () => {
  it("accepts a valid token and attaches the user", async () => {
    const user = await verified();
    const res = await request(app)
      .get("/full")
      .set(bearer(tokenFor(user)));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: user.id, role: "Applicant", scope: "full" });
  });

  it.each([
    ["no header", undefined],
    ["wrong scheme", "Basic abc"],
    ["no token", "Bearer"],
    ["extra parts", "Bearer a b"],
    ["garbage token", "Bearer not.a.jwt"],
  ])("returns 401 UNAUTHENTICATED for %s", async (_name, header) => {
    const req = request(app).get("/full");
    if (header) req.set("Authorization", header);
    const res = await req;
    expect(res.status).toBe(401);
    expect(res.body.error).toMatchObject({
      code: "UNAUTHENTICATED",
      requestId: expect.any(String),
    });
  });

  it("returns 401 for an expired token", async () => {
    const user = await verified();
    const expired = jwt.sign({ role: "Applicant", scope: "full" }, env.JWT_ACCESS_SECRET, {
      subject: user.id as string,
      jwtid: "j",
      expiresIn: -5,
    });
    const res = await request(app).get("/full").set(bearer(expired));
    expect(res.status).toBe(401);
  });

  it("returns 401 when the account no longer exists", async () => {
    const user = await verified();
    const token = tokenFor(user);
    await db("users").where({ id: user.id }).delete();
    const res = await request(app).get("/full").set(bearer(token));
    expect(res.status).toBe(401);
  });

  it("rejects a deactivated user on the very next request", async () => {
    const user = await verified();
    const token = tokenFor(user);
    expect((await request(app).get("/full").set(bearer(token))).status).toBe(200);

    await db("users").where({ id: user.id }).update({ is_active: 0 });

    const res = await request(app).get("/full").set(bearer(token));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_DEACTIVATED");
  });

  it("uses the role from the database, not the one in the token", async () => {
    const user = await verified({ role: "SuperAdmin" });
    const token = tokenFor(user); // minted while the user is a Super Admin
    expect((await request(app).get("/super").set(bearer(token))).status).toBe(200);

    await db("users").where({ id: user.id }).update({ role: "Applicant" });

    const res = await request(app).get("/super").set(bearer(token));
    expect(res.status).toBe(403);
    expect((await request(app).get("/full").set(bearer(token))).body.role).toBe("Applicant");
  });

  it("does not let a forged role claim grant access", async () => {
    const user = await verified(); // Applicant in the DB
    const forged = signAccessToken({ sub: user.id as string, role: "SuperAdmin", scope: "full" });
    const res = await request(app).get("/super").set(bearer(forged.token));
    expect(res.status).toBe(403);
  });

  it("rejects an onboarding token on a normal route", async () => {
    const user = await verified();
    const res = await request(app)
      .get("/full")
      .set(bearer(tokenFor(user, "onboarding")));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("accepts an onboarding token where allowOnboarding is set", async () => {
    const user = await createUser(); // unverified is fine for onboarding
    const res = await request(app)
      .get("/onboarding-ok")
      .set(bearer(tokenFor(user, "onboarding")));
    expect(res.status).toBe(200);
    expect(res.body.scope).toBe("onboarding");
  });

  it("still accepts a full token on an onboarding-friendly route", async () => {
    const user = await verified();
    const res = await request(app)
      .get("/onboarding-ok")
      .set(bearer(tokenFor(user)));
    expect(res.status).toBe(200);
  });

  it("rejects a full-scope token for an unverified account", async () => {
    const user = await createUser({ is_verified: 0 });
    const res = await request(app)
      .get("/full")
      .set(bearer(tokenFor(user)));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_NOT_VERIFIED");
  });

  it("rejects a deactivated user even with an onboarding token", async () => {
    const user = await createUser({ is_active: 0 });
    const res = await request(app)
      .get("/onboarding-ok")
      .set(bearer(tokenFor(user, "onboarding")));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_DEACTIVATED");
  });
});

describe("requireRole() / requireCapability()", () => {
  it("returns 403 FORBIDDEN for a role that is not listed", async () => {
    const user = await verified({ role: "TransportInCharge" });
    const res = await request(app)
      .get("/super")
      .set(bearer(tokenFor(user)));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("lets a listed role through", async () => {
    const user = await verified({ role: "SuperAdmin" });
    expect(
      (
        await request(app)
          .get("/super")
          .set(bearer(tokenFor(user)))
      ).status,
    ).toBe(200);
  });

  it("returns 401 when used without authenticate()", async () => {
    expect((await request(app).get("/no-auth-role")).status).toBe(401);
  });

  it("requireCapability follows the permission predicate", async () => {
    const superAdmin = await verified({ role: "SuperAdmin" });
    const incharge = await verified({ role: "TransportInCharge" });
    expect(
      (
        await request(app)
          .get("/capability")
          .set(bearer(tokenFor(superAdmin)))
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .get("/capability")
          .set(bearer(tokenFor(incharge)))
      ).status,
    ).toBe(403);
  });
});

describe("auth rate limiters", () => {
  it("loginLimiter allows 10 attempts per IP+email, then returns 429 with retryAfterSeconds", async () => {
    for (let i = 0; i < 10; i += 1) {
      expect((await request(app).post("/login").send({ email: "a@sust.edu" })).status).toBe(200);
    }
    const res = await request(app).post("/login").send({ email: "a@sust.edu" });
    expect(res.status).toBe(429);
    expect(res.body.error).toMatchObject({
      code: "RATE_LIMITED",
      details: { retryAfterSeconds: expect.any(Number) },
    });
  });

  it("loginLimiter counts each email separately and ignores email case", async () => {
    for (let i = 0; i < 10; i += 1) {
      await request(app).post("/login").send({ email: "A@sust.edu" });
    }
    expect((await request(app).post("/login").send({ email: "a@SUST.edu" })).status).toBe(429);
    expect((await request(app).post("/login").send({ email: "b@sust.edu" })).status).toBe(200);
  });

  it("registerLimiter allows 10 per hour per IP", async () => {
    for (let i = 0; i < 10; i += 1) {
      expect((await request(app).post("/register").send({})).status).toBe(200);
    }
    expect((await request(app).post("/register").send({})).status).toBe(429);
  });

  it("otpLimiter allows 20 per window per IP", async () => {
    for (let i = 0; i < 20; i += 1) {
      expect((await request(app).post("/otp").send({})).status).toBe(200);
    }
    expect((await request(app).post("/otp").send({})).status).toBe(429);
  });

  it("resetRateLimitStores clears all counters", async () => {
    for (let i = 0; i < 11; i += 1) await request(app).post("/login").send({ email: "a@sust.edu" });
    resetRateLimitStores();
    expect((await request(app).post("/login").send({ email: "a@sust.edu" })).status).toBe(200);
  });
});
