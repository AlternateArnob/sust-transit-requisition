import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { resetRateLimitStores } from "../../src/middleware/rateLimit.js";
import { verifyPassword } from "../../src/services/password.js";
import { createRefreshToken } from "../../src/services/tokens.js";
import { db, truncateAll } from "../helpers/db.js";
import {
  PASSWORD,
  bearer,
  createFreshApplicant,
  createUserWithPassword,
} from "../helpers/session.js";

const BASE = env.API_BASE_PATH;
const app = createApp();
const NEW_PASSWORD = "an-entirely-different-secret";

const change = (token: Record<string, string>, body: object) =>
  request(app).put(`${BASE}/me/password`).set(token).send(body);
const login = (email: unknown, password: string) =>
  request(app).post(`${BASE}/auth/login`).send({ email, password });

beforeEach(async () => {
  await truncateAll();
  resetRateLimitStores();
});

afterAll(async () => {
  await db.destroy();
});

describe("PUT /me/password", () => {
  it("changes the password when the current one is right, and answers 204", async () => {
    const user = await createUserWithPassword();
    const res = await change(bearer(user), {
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
    });
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});

    const row = await db("users").where({ id: user.id }).first();
    expect(await verifyPassword(row.password_hash, NEW_PASSWORD)).toBe(true);
    expect(row.password_hash).not.toContain(NEW_PASSWORD);
    expect((await login(user.email, NEW_PASSWORD)).status).toBe(200);
    expect((await login(user.email, PASSWORD)).status).toBe(401);
  });

  it("requires the current password: a wrong one is a 422 on currentPassword and changes nothing", async () => {
    const user = await createUserWithPassword();
    const before = (await db("users").where({ id: user.id }).first()).password_hash;
    const res = await change(bearer(user), {
      currentPassword: "not-my-password",
      newPassword: NEW_PASSWORD,
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual([
      { path: "currentPassword", message: "Current password is incorrect." },
    ]);
    expect((await db("users").where({ id: user.id }).first()).password_hash).toBe(before);
    expect((await login(user.email, PASSWORD)).status).toBe(200);
  });

  it("is not mistaken for an expired session: it never answers 401 for a wrong current password", async () => {
    const user = await createUserWithPassword();
    const res = await change(bearer(user), { currentPassword: "nope", newPassword: NEW_PASSWORD });
    expect(res.status).not.toBe(401);
  });

  it("enforces the length policy on the new password", async () => {
    const user = await createUserWithPassword();
    const res = await change(bearer(user), {
      currentPassword: PASSWORD,
      newPassword: "x".repeat(env.PASSWORD_MIN_LENGTH - 1),
    });
    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual([
      {
        path: "newPassword",
        message: `Password must be at least ${env.PASSWORD_MIN_LENGTH} characters`,
      },
    ]);
  });

  it("refuses to 'change' to the same password", async () => {
    const user = await createUserWithPassword();
    const res = await change(bearer(user), { currentPassword: PASSWORD, newPassword: PASSWORD });
    expect(res.status).toBe(422);
    expect(res.body.error.details[0]).toEqual({
      path: "newPassword",
      message: "New password must be different from the current password.",
    });
  });

  it("requires both fields and rejects unknown keys", async () => {
    const user = await createUserWithPassword();
    expect((await change(bearer(user), { newPassword: NEW_PASSWORD })).status).toBe(422);
    expect((await change(bearer(user), { currentPassword: PASSWORD })).status).toBe(422);
    expect(
      (
        await change(bearer(user), {
          currentPassword: PASSWORD,
          newPassword: NEW_PASSWORD,
          extra: 1,
        })
      ).status,
    ).toBe(422);
  });

  it("signs out every other session: all refresh tokens are revoked", async () => {
    const user = await createUserWithPassword();
    const phone = await createRefreshToken(String(user.id));
    const laptop = await createRefreshToken(String(user.id));
    const bystander = await createUserWithPassword();
    const bystanderToken = await createRefreshToken(String(bystander.id));

    const res = await change(bearer(user), {
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
    });
    expect(res.status).toBe(204);

    const rows = await db("refresh_tokens").where({ user_id: user.id });
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.revoked_at).not.toBeNull();
    expect([phone.id, laptop.id].sort()).toEqual(rows.map((r) => r.id).sort());
    // Someone else's session is untouched.
    const other = await db("refresh_tokens").where({ id: bystanderToken.id }).first();
    expect(other.revoked_at).toBeNull();
  });

  it("does not revoke sessions when the change is refused", async () => {
    const user = await createUserWithPassword();
    const token = await createRefreshToken(String(user.id));
    await change(bearer(user), { currentPassword: "wrong", newPassword: NEW_PASSWORD });
    expect((await db("refresh_tokens").where({ id: token.id }).first()).revoked_at).toBeNull();
  });

  it("needs a full login: no token, and an onboarding token, are both refused", async () => {
    const user = await createFreshApplicant();
    const body = { currentPassword: PASSWORD, newPassword: NEW_PASSWORD };
    expect((await request(app).put(`${BASE}/me/password`).send(body)).status).toBe(401);
    const res = await change(bearer(user, "onboarding"), body);
    expect(res.status).toBe(403);
  });

  it("answers 422 for an account that has no password at all", async () => {
    const user = await createFreshApplicant();
    const res = await change(bearer(user), {
      currentPassword: "anything",
      newPassword: NEW_PASSWORD,
    });
    expect(res.status).toBe(422);
    expect(res.body.error.details[0].path).toBe("currentPassword");
  });

  it("limits guessing: 10 attempts per user, then 429 even for the right password", async () => {
    const user = await createUserWithPassword();
    const other = await createUserWithPassword();
    for (let i = 0; i < 10; i += 1) {
      const res = await change(bearer(user), {
        currentPassword: `guess-${i}`,
        newPassword: NEW_PASSWORD,
      });
      expect(res.status).toBe(422);
    }
    const blocked = await change(bearer(user), {
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
    });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    expect((await login(user.email, PASSWORD)).status).toBe(200);
    // Another user is not affected.
    const fine = await change(bearer(other), {
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
    });
    expect(fine.status).toBe(204);
  });
});
