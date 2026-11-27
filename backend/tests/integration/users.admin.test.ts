import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { resetRateLimitStores } from "../../src/middleware/rateLimit.js";
import * as userAdmin from "../../src/modules/users/user.admin.service.js";
import { verifyPassword } from "../../src/services/password.js";
import { createRefreshToken } from "../../src/services/tokens.js";
import { db, truncateAll } from "../helpers/db.js";
import { createRequisition, createUser } from "../helpers/factories.js";
import {
  bearer,
  createFileRow,
  createUserWithPassword,
  PASSWORD,
  seedDirectory,
} from "../helpers/session.js";

const BASE = env.API_BASE_PATH;
const app = createApp();

type Row = Record<string, unknown>;
const auth = (user: Row) => bearer(user);

const get = (user: Row, query = "") => request(app).get(`${BASE}/users${query}`).set(auth(user));
const post = (user: Row, body: object) =>
  request(app).post(`${BASE}/users`).set(auth(user)).send(body);
const patch = (user: Row, id: unknown, body: object) =>
  request(app).patch(`${BASE}/users/${id}`).set(auth(user)).send(body);
const del = (user: Row, id: unknown) => request(app).delete(`${BASE}/users/${id}`).set(auth(user));

const userRow = (id: unknown) => db("users").where({ id }).first();
const auditRows = (action?: string) =>
  action ? db("audit_logs").where({ action }).orderBy("id") : db("audit_logs").orderBy("id");

let n = 0;
const superAdmin = (overrides: Row = {}) =>
  createUser({
    email: `superadmin${++n}@sust.edu`,
    role: "SuperAdmin",
    is_verified: 1,
    full_name: `Super Admin ${n}`,
    ...overrides,
  });
const person = (overrides: Row = {}) =>
  createUser({
    email: `person${++n}@sust.edu`,
    is_verified: 1,
    full_name: `Person ${n}`,
    ...overrides,
  });

beforeEach(async () => {
  await truncateAll();
  resetRateLimitStores();
});
afterAll(() => db.destroy());

describe("access control", () => {
  it("requires authentication on every route", async () => {
    const id = randomUUID();
    for (const res of [
      await request(app).get(`${BASE}/users`),
      await request(app).post(`${BASE}/users`).send({}),
      await request(app).patch(`${BASE}/users/${id}`).send({}),
      await request(app).delete(`${BASE}/users/${id}`),
    ]) {
      expect(res.status).toBe(401);
    }
  });

  it.each(["Applicant", "DepartmentHead", "TransportInCharge", "TransportAdministrator"])(
    "gives a %s 403 on every route",
    async (role) => {
      const user = await person({ role });
      const target = await person();
      for (const res of [
        await get(user),
        await post(user, {
          fullName: "X",
          email: "x@sust.edu",
          role: "SuperAdmin",
          password: "long-enough-password",
        }),
        await patch(user, target.id, { fullName: "Hacked" }),
        await del(user, target.id),
      ]) {
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("FORBIDDEN");
      }
      expect((await userRow(target.id)).full_name).not.toBe("Hacked");
      expect(await auditRows()).toHaveLength(0);
    },
  );

  it("rejects an onboarding token even for a Super Admin", async () => {
    const admin = await superAdmin();
    const res = await request(app).get(`${BASE}/users`).set(bearer(admin, "onboarding"));
    expect(res.status).toBe(403);
  });

  it("checks the role in the database, not in the token", async () => {
    const admin = await superAdmin();
    const headers = auth(admin);
    await db("users").where({ id: admin.id }).update({ role: "Applicant" });
    expect((await request(app).get(`${BASE}/users`).set(headers)).status).toBe(403);
  });
});

describe("GET /users", () => {
  it("lists accounts with paging metadata and never exposes secrets", async () => {
    const admin = await superAdmin();
    await createUserWithPassword({ email: "with-login@sust.edu", role: "TransportInCharge" });
    const res = await get(admin);

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 2 });
    expect(res.body.data).toHaveLength(2);
    expect(JSON.stringify(res.body)).not.toMatch(/hash|argon2|password|failed|locked/i);
    expect(res.body.data[0]).toMatchObject({
      id: expect.any(String),
      email: expect.any(String),
      role: expect.any(String),
      isActive: true,
    });
  });

  it("filters by role", async () => {
    const admin = await superAdmin();
    await person({ role: "TransportInCharge" });
    await person({ role: "TransportInCharge" });
    await person({ role: "Applicant" });
    const res = await get(admin, "?role=TransportInCharge");
    expect(res.body.meta.total).toBe(2);
    expect(res.body.data.every((u: Row) => u.role === "TransportInCharge")).toBe(true);
  });

  it("filters by active status", async () => {
    const admin = await superAdmin();
    await person({ is_active: 0 });
    await person({ is_active: 0 });
    const inactive = await get(admin, "?isActive=false");
    expect(inactive.body.meta.total).toBe(2);
    expect(inactive.body.data.every((u: Row) => u.isActive === false)).toBe(true);
    const active = await get(admin, "?isActive=true");
    expect(active.body.meta.total).toBe(1);
  });

  it("combines filters", async () => {
    const admin = await superAdmin();
    await person({ role: "Applicant", is_active: 0 });
    await person({ role: "Applicant" });
    const res = await get(admin, "?role=Applicant&isActive=false");
    expect(res.body.meta.total).toBe(1);
  });

  it("searches name, email and mobile, ignoring case", async () => {
    const admin = await superAdmin();
    await person({ full_name: "Rahim Uddin", email: "rahim@sust.edu", mobile: "01711000111" });
    await person({ full_name: "Karim Ali", email: "karim@sust.edu", mobile: "01822000222" });

    expect((await get(admin, "?q=RAHIM")).body.data.map((u: Row) => u.email)).toEqual([
      "rahim@sust.edu",
    ]);
    expect((await get(admin, "?q=karim@sust")).body.meta.total).toBe(1);
    expect((await get(admin, "?q=0182200")).body.meta.total).toBe(1);
    expect((await get(admin, "?q=nobody")).body.meta.total).toBe(0);
  });

  it("treats % and _ in the search text literally", async () => {
    const admin = await superAdmin();
    await person({ full_name: "100% Real", email: "real@sust.edu" });
    await person({ full_name: "Other Person", email: "other@sust.edu" });
    expect((await get(admin, "?q=%25")).body.data.map((u: Row) => u.email)).toEqual([
      "real@sust.edu",
    ]);
    expect((await get(admin, "?q=_")).body.meta.total).toBe(0);
  });

  it("pages through results without repeating or skipping anyone", async () => {
    const admin = await superAdmin();
    for (let i = 0; i < 6; i += 1) await person();
    const seen: string[] = [];
    for (const page of [1, 2, 3]) {
      const res = await get(admin, `?pageSize=3&page=${page}&sort=email:asc`);
      expect(res.body.meta).toEqual({ page, pageSize: 3, total: 7 });
      seen.push(...res.body.data.map((u: Row) => u.id));
    }
    expect(seen).toHaveLength(7);
    expect(new Set(seen).size).toBe(7);
  });

  it("returns an empty page past the end", async () => {
    const admin = await superAdmin();
    const res = await get(admin, "?page=9");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(1);
  });

  it("sorts", async () => {
    const admin = await superAdmin({ full_name: "Mmm" });
    await person({ full_name: "Aaa" });
    await person({ full_name: "Zzz" });
    const asc = await get(admin, "?sort=fullName:asc");
    expect(asc.body.data.map((u: Row) => u.fullName)).toEqual(["Aaa", "Mmm", "Zzz"]);
    const desc = await get(admin, "?sort=fullName:desc");
    expect(desc.body.data.map((u: Row) => u.fullName)).toEqual(["Zzz", "Mmm", "Aaa"]);
  });

  it.each([
    "?pageSize=101",
    "?pageSize=0",
    "?page=0",
    "?role=Wizard",
    "?isActive=maybe",
    "?sort=password:asc",
    "?sort=email:sideways",
    "?unknown=1",
  ])("rejects %s with 422", async (query) => {
    const admin = await superAdmin();
    const res = await get(admin, query);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /users", () => {
  const body = (overrides: Row = {}) => ({
    fullName: "Transport Officer",
    email: "officer@sust.edu",
    role: "TransportInCharge",
    password: "a-long-enough-password",
    ...overrides,
  });

  it("creates a verified, active account that can log in straight away", async () => {
    const admin = await superAdmin();
    const res = await post(admin, body());

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      email: "officer@sust.edu",
      fullName: "Transport Officer",
      role: "TransportInCharge",
      isVerified: true,
      isActive: true,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/hash|argon2|password/i);

    const row = await userRow(res.body.id);
    expect(row.password_hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(row.password_hash, "a-long-enough-password")).toBe(true);
    expect(await db("otp_challenges")).toHaveLength(0);

    const login = await request(app)
      .post(`${BASE}/auth/login`)
      .send({ email: "officer@sust.edu", password: "a-long-enough-password" });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe("TransportInCharge");
    expect(login.body.accessToken).toEqual(expect.any(String));
  });

  it.each(["TransportInCharge", "TransportAdministrator", "SuperAdmin"])(
    "can appoint a %s",
    async (role) => {
      const admin = await superAdmin();
      const res = await post(admin, body({ role, email: `${role.toLowerCase()}@sust.edu` }));
      expect(res.status).toBe(201);
      expect(res.body.role).toBe(role);
    },
  );

  it.each(["Applicant", "DepartmentHead", "Janitor"])("refuses the role %s", async (role) => {
    const admin = await superAdmin();
    const res = await post(admin, body({ role }));
    expect(res.status).toBe(422);
    expect(res.body.error.details[0].path).toBe("role");
  });

  it("lower-cases and trims the email", async () => {
    const admin = await superAdmin();
    const res = await post(admin, body({ email: "  New.Person@SUST.edu " }));
    expect(res.status).toBe(201);
    expect(res.body.email).toBe("new.person@sust.edu");
  });

  it("returns 409 EMAIL_TAKEN for a duplicate email, whatever its case", async () => {
    const admin = await superAdmin();
    await person({ email: "taken@sust.edu" });
    for (const email of ["taken@sust.edu", "TAKEN@sust.edu"]) {
      const res = await post(admin, body({ email }));
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("EMAIL_TAKEN");
    }
    expect(await db("users").where({ email: "taken@sust.edu" })).toHaveLength(1);
  });

  it("creates only one account when two requests race for the same email", async () => {
    const admin = await superAdmin();
    const results = await Promise.all([post(admin, body()), post(admin, body())]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await db("users").where({ email: "officer@sust.edu" })).toHaveLength(1);
  });

  it("enforces the password policy", async () => {
    const admin = await superAdmin();
    const short = await post(admin, body({ password: "short" }));
    expect(short.status).toBe(422);
    expect(short.body.error.details).toEqual([
      { path: "password", message: expect.stringContaining(String(env.PASSWORD_MIN_LENGTH)) },
    ]);
    expect(await db("users").where({ email: "officer@sust.edu" })).toHaveLength(0);
  });

  it.each([
    ["fullName", { fullName: "" }],
    ["fullName", { fullName: undefined }],
    ["email", { email: "not-an-email" }],
    ["email", { email: undefined }],
    ["password", { password: undefined }],
    ["role", { role: undefined }],
  ])("requires a valid %s", async (path, overrides) => {
    const admin = await superAdmin();
    const res = await post(admin, body(overrides));
    expect(res.status).toBe(422);
    expect(res.body.error.details.map((d: Row) => d.path)).toContain(path);
  });

  it("rejects fields the endpoint does not accept (no mass assignment)", async () => {
    const admin = await superAdmin();
    const res = await post(admin, body({ isActive: false, isVerified: false, id: randomUUID() }));
    expect(res.status).toBe(422);
    expect(res.body.error.details.map((d: Row) => d.path).sort()).toEqual([
      "id",
      "isActive",
      "isVerified",
    ]);
  });

  it("writes a user.created audit row without any secret", async () => {
    const admin = await superAdmin();
    const res = await post(admin, body());
    const [row] = await auditRows("user.created");

    expect(row).toMatchObject({
      actor_user_id: admin.id,
      actor_role: "SuperAdmin",
      entity_type: "user",
      entity_id: res.body.id,
      before_json: null,
      request_id: expect.any(String),
    });
    expect(row.after_json).toMatchObject({
      email: "officer@sust.edu",
      role: "TransportInCharge",
      isActive: true,
    });
    expect(JSON.stringify(row)).not.toMatch(/argon2|a-long-enough-password/);
  });

  it("writes nothing when validation fails", async () => {
    const admin = await superAdmin();
    await post(admin, body({ password: "x" }));
    expect(await db("users")).toHaveLength(1);
    expect(await auditRows()).toHaveLength(0);
  });
});

describe("PATCH /users/:id", () => {
  describe("editing details", () => {
    it("updates name, email and mobile and records before/after", async () => {
      const admin = await superAdmin();
      const target = await person({ full_name: "Old Name", mobile: "01711111111" });
      const res = await patch(admin, target.id, {
        fullName: "New Name",
        email: "New.Email@sust.edu",
        mobile: "01822222222",
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: target.id,
        fullName: "New Name",
        email: "new.email@sust.edu",
        mobile: "01822222222",
      });
      expect(await userRow(target.id)).toMatchObject({
        full_name: "New Name",
        email: "new.email@sust.edu",
        mobile: "01822222222",
      });

      const [row] = await auditRows("user.updated");
      expect(row).toMatchObject({ actor_user_id: admin.id, entity_id: target.id });
      expect(row.before_json).toMatchObject({ fullName: "Old Name", mobile: "01711111111" });
      expect(row.after_json).toMatchObject({ fullName: "New Name", email: "new.email@sust.edu" });
      // Details only: no role/active audit rows and no notification.
      expect(await auditRows()).toHaveLength(1);
      expect(await db("notifications")).toHaveLength(0);
    });

    it("lets an account keep its own email (not a duplicate of itself)", async () => {
      const admin = await superAdmin();
      const target = await person({ email: "same@sust.edu" });
      const res = await patch(admin, target.id, { email: "SAME@sust.edu", fullName: "Renamed" });
      expect(res.status).toBe(200);
    });

    it("returns 409 EMAIL_TAKEN when the email belongs to someone else", async () => {
      const admin = await superAdmin();
      await person({ email: "other@sust.edu" });
      const target = await person();
      const res = await patch(admin, target.id, { email: "OTHER@sust.edu" });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("EMAIL_TAKEN");
      expect((await userRow(target.id)).email).toBe(target.email);
    });

    it("clears the mobile number with null or an empty string", async () => {
      const admin = await superAdmin();
      const a = await person({ mobile: "01711111111" });
      const b = await person({ mobile: "01722222222" });
      expect((await patch(admin, a.id, { mobile: null })).status).toBe(200);
      expect((await patch(admin, b.id, { mobile: "" })).status).toBe(200);
      expect((await userRow(a.id)).mobile).toBeNull();
      expect((await userRow(b.id)).mobile).toBeNull();
    });

    it("does nothing, and logs nothing, when no value actually changes", async () => {
      const admin = await superAdmin();
      const target = await person({ full_name: "Same Name", role: "TransportInCharge" });
      const res = await patch(admin, target.id, {
        fullName: "Same Name",
        role: "TransportInCharge",
        isActive: true,
      });
      expect(res.status).toBe(200);
      expect(await auditRows()).toHaveLength(0);
      expect(await db("notifications")).toHaveLength(0);
    });

    it("accepts an empty body as a no-op", async () => {
      const admin = await superAdmin();
      const target = await person();
      expect((await patch(admin, target.id, {})).status).toBe(200);
      expect(await auditRows()).toHaveLength(0);
    });

    it("returns 404 for an unknown user and 422 for a malformed id", async () => {
      const admin = await superAdmin();
      expect((await patch(admin, randomUUID(), { fullName: "X" })).status).toBe(404);
      const bad = await patch(admin, "not-a-uuid", { fullName: "X" });
      expect(bad.status).toBe(422);
    });

    it.each([
      ["a password", { password: "hunter2hunter2" }],
      ["a password hash", { passwordHash: "x" }],
      ["is_verified", { isVerified: false }],
      ["an id", { id: randomUUID() }],
      ["an unknown key", { nickname: "x" }],
    ])("refuses %s (no mass assignment)", async (_name, body) => {
      const admin = await superAdmin();
      const target = await person();
      const res = await patch(admin, target.id, body);
      expect(res.status).toBe(422);
      expect(res.body.error.details[0].message).toBe("Unrecognized key");
    });

    it.each([
      [{ fullName: "" }],
      [{ email: "nope" }],
      [{ mobile: "abc" }],
      [{ role: "Janitor" }],
      [{ isActive: "yes" }],
    ])("rejects invalid values %o", async (body) => {
      const admin = await superAdmin();
      const target = await person();
      expect((await patch(admin, target.id, body)).status).toBe(422);
    });
  });

  describe("self-protection", () => {
    it("refuses to change your own role", async () => {
      const admin = await superAdmin();
      const res = await patch(admin, admin.id, { role: "Applicant" });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatchObject({
        code: "FORBIDDEN",
        message: "You can't change your own role or active status here.",
      });
      expect((await userRow(admin.id)).role).toBe("SuperAdmin");
    });

    it("refuses to deactivate yourself", async () => {
      const admin = await superAdmin();
      await superAdmin(); // a second one exists, so only the self rule can apply
      const res = await patch(admin, admin.id, { isActive: false });
      expect(res.status).toBe(403);
      expect((await userRow(admin.id)).is_active).toBe(1);
    });

    it("still lets you edit your own name and mobile, and resend your unchanged role", async () => {
      const admin = await superAdmin();
      const res = await patch(admin, admin.id, {
        fullName: "My New Name",
        mobile: "01733333333",
        role: "SuperAdmin",
        isActive: true,
      });
      expect(res.status).toBe(200);
      expect(res.body.fullName).toBe("My New Name");
    });
  });

  describe("the last active Super Admin", () => {
    // The caller of the API is always an active Super Admin, so through HTTP the guard is reached
    // only in a race. These tests call the service with an actor that is not the target.
    const actor = () => ({ actor: { id: randomUUID(), role: "SuperAdmin" as const } });

    it("cannot be demoted", async () => {
      const only = await superAdmin();
      await expect(
        userAdmin.update(actor(), only.id as string, { role: "Applicant" }),
      ).rejects.toMatchObject({
        status: 409,
        code: "LAST_SUPER_ADMIN",
      });
      expect((await userRow(only.id)).role).toBe("SuperAdmin");
    });

    it("cannot be deactivated", async () => {
      const only = await superAdmin();
      await expect(
        userAdmin.update(actor(), only.id as string, { isActive: false }),
      ).rejects.toMatchObject({
        code: "LAST_SUPER_ADMIN",
      });
      expect((await userRow(only.id)).is_active).toBe(1);
    });

    it("does not count inactive Super Admins", async () => {
      const only = await superAdmin();
      await superAdmin({ is_active: 0 });
      await expect(
        userAdmin.update(actor(), only.id as string, { isActive: false }),
      ).rejects.toMatchObject({
        code: "LAST_SUPER_ADMIN",
      });
    });

    it("can be demoted when another active Super Admin exists", async () => {
      const first = await superAdmin();
      await superAdmin();
      const res = await userAdmin.update(actor(), first.id as string, { role: "Applicant" });
      expect(res.role).toBe("Applicant");
    });

    it("an inactive Super Admin can be changed freely", async () => {
      await superAdmin();
      const inactive = await superAdmin({ is_active: 0 });
      const res = await userAdmin.update(actor(), inactive.id as string, { role: "Applicant" });
      expect(res.role).toBe("Applicant");
    });

    it("always leaves one active Super Admin when two demote each other at the same time", async () => {
      const a = await superAdmin();
      const b = await superAdmin();
      const headersA = auth(a);
      const headersB = auth(b);

      const results = await Promise.all([
        request(app).patch(`${BASE}/users/${b.id}`).set(headersA).send({ role: "Applicant" }),
        request(app).patch(`${BASE}/users/${a.id}`).set(headersB).send({ role: "Applicant" }),
      ]);

      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
      const failed = results.find((r) => r.status !== 200)!;
      // Either the second request lost the race for the lock (409) or saw the committed change (403).
      expect([403, 409]).toContain(failed.status);
      const remaining = await db("users").where({ role: "SuperAdmin", is_active: 1 });
      expect(remaining).toHaveLength(1);
    });
  });

  describe("role changes", () => {
    it("changes the role, notifies the user and audits it", async () => {
      const admin = await superAdmin();
      const target = await person({ role: "Applicant" });
      const res = await patch(admin, target.id, { role: "TransportInCharge" });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe("TransportInCharge");

      const [note] = await db("notifications");
      expect(note).toMatchObject({
        recipient_user_id: target.id,
        type: "Account Status Changed",
        message: "Your account was role changed to TransportInCharge by a Super Admin.",
        link_type: "user",
        link_id: target.id,
        is_read: 0,
      });

      const [row] = await auditRows("user.role_changed");
      expect(row).toMatchObject({ actor_user_id: admin.id, entity_id: target.id });
      expect(row.before_json.role).toBe("Applicant");
      expect(row.after_json.role).toBe("TransportInCharge");
    });

    it("takes effect on the user's existing token immediately", async () => {
      const admin = await superAdmin();
      const target = await person({ role: "Applicant" });
      const headers = auth(target);
      expect((await request(app).get(`${BASE}/users`).set(headers)).status).toBe(403);

      await patch(admin, target.id, { role: "SuperAdmin" });
      expect((await request(app).get(`${BASE}/users`).set(headers)).status).toBe(200);
    });

    it("does not log the user out when only the role changes", async () => {
      const admin = await superAdmin();
      const target = await person();
      await createRefreshToken(target.id as string);
      await patch(admin, target.id, { role: "TransportAdministrator" });
      expect(await db("refresh_tokens").whereNull("revoked_at")).toHaveLength(1);
    });
  });

  describe("deactivation and reactivation", () => {
    it("deactivates, revokes every refresh token, notifies and audits", async () => {
      const admin = await superAdmin();
      const target = await person();
      const other = await person();
      await createRefreshToken(target.id as string);
      await createRefreshToken(target.id as string);
      await createRefreshToken(other.id as string);

      const res = await patch(admin, target.id, { isActive: false });
      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(false);

      expect(
        await db("refresh_tokens").where({ user_id: target.id }).whereNull("revoked_at"),
      ).toHaveLength(0);
      expect(
        await db("refresh_tokens").where({ user_id: other.id }).whereNull("revoked_at"),
      ).toHaveLength(1);

      const [note] = await db("notifications");
      expect(note.message).toBe("Your account was deactivated by a Super Admin.");
      expect(note.recipient_user_id).toBe(target.id);

      const [row] = await auditRows("user.deactivated");
      expect(row.before_json.isActive).toBe(true);
      expect(row.after_json.isActive).toBe(false);
    });

    it("stops the deactivated user's access token on the very next request", async () => {
      const admin = await superAdmin();
      const target = await person({ role: "TransportInCharge", password_hash: null });
      const headers = auth(target);
      expect((await request(app).get(`${BASE}/me`).set(headers)).status).toBe(200);

      await patch(admin, target.id, { isActive: false });

      const res = await request(app).get(`${BASE}/me`).set(headers);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("ACCOUNT_DEACTIVATED");
    });

    it("blocks login and refresh for a deactivated user", async () => {
      const admin = await superAdmin();
      const target = await createUserWithPassword({
        email: "gone@sust.edu",
        role: "TransportInCharge",
        full_name: "Gone",
      });
      const login = await request(app)
        .post(`${BASE}/auth/login`)
        .send({ email: "gone@sust.edu", password: PASSWORD });
      expect(login.status).toBe(200);
      const cookie = String(login.headers["set-cookie"]).split(";")[0] as string;

      await patch(admin, target.id, { isActive: false });

      const again = await request(app)
        .post(`${BASE}/auth/login`)
        .send({ email: "gone@sust.edu", password: PASSWORD });
      expect(again.status).toBe(403);
      const refresh = await request(app)
        .post(`${BASE}/auth/refresh`)
        .set("Cookie", cookie)
        .set("X-Requested-With", "fetch");
      expect(refresh.status).toBe(401);
    });

    it("reactivates, notifies and audits it as user.reactivated", async () => {
      const admin = await superAdmin();
      const target = await person({ is_active: 0 });
      const res = await patch(admin, target.id, { isActive: true });
      expect(res.body.isActive).toBe(true);
      expect((await db("notifications").first()).message).toBe(
        "Your account was reactivated by a Super Admin.",
      );
      expect(await auditRows("user.reactivated")).toHaveLength(1);
      expect(await auditRows("user.deactivated")).toHaveLength(0);
    });

    it("words a combined change as one notification and writes one audit row per kind of change", async () => {
      const admin = await superAdmin();
      const target = await person({ is_active: 0, role: "Applicant", full_name: "Before" });
      await patch(admin, target.id, {
        isActive: true,
        role: "TransportAdministrator",
        fullName: "After",
      });

      const notes = await db("notifications");
      expect(notes).toHaveLength(1);
      expect(notes[0].message).toBe(
        "Your account was reactivated and role changed to TransportAdministrator by a Super Admin.",
      );
      expect((await auditRows()).map((r) => r.action).sort()).toEqual([
        "user.reactivated",
        "user.role_changed",
        "user.updated",
      ]);
    });
  });

  describe("Department Head scope", () => {
    beforeEach(seedDirectory);

    it("requires a department or office when the role becomes DepartmentHead", async () => {
      const admin = await superAdmin();
      const target = await person();
      const res = await patch(admin, target.id, { role: "DepartmentHead" });
      expect(res.status).toBe(422);
      expect(res.body.error.details[0].path).toBe("headOfDepartment");
      expect((await userRow(target.id)).role).toBe("Applicant");
      expect(await db("notifications")).toHaveLength(0);
    });

    it("accepts a department and stores the directory's spelling", async () => {
      const admin = await superAdmin();
      const target = await person();
      const res = await patch(admin, target.id, {
        role: "DepartmentHead",
        headOfDepartment: "  computer science and engineering ",
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        role: "DepartmentHead",
        headOfDepartment: "Computer Science and Engineering",
      });
      expect(res.body).not.toHaveProperty("headOfOffice");
    });

    it("accepts an office", async () => {
      const admin = await superAdmin();
      const target = await person();
      const [office] = await db("directory_units").where({ kind: "Office" }).limit(1);
      const res = await patch(admin, target.id, {
        role: "DepartmentHead",
        headOfOffice: office.name.toUpperCase(),
      });
      expect(res.status).toBe(200);
      expect(res.body.headOfOffice).toBe(office.name);
    });

    it("rejects a name that is not in the directory, or is in the wrong list", async () => {
      const admin = await superAdmin();
      const target = await person();
      const [office] = await db("directory_units").where({ kind: "Office" }).limit(1);
      const unknown = await patch(admin, target.id, {
        role: "DepartmentHead",
        headOfDepartment: "Department of Magic",
      });
      expect(unknown.status).toBe(422);
      expect(unknown.body.error.details[0].path).toBe("headOfDepartment");

      const wrongKind = await patch(admin, target.id, {
        role: "DepartmentHead",
        headOfDepartment: office.name,
      });
      expect(wrongKind.status).toBe(422);
      expect((await userRow(target.id)).role).toBe("Applicant");
    });

    it("keeps the scope when the head is edited without sending it", async () => {
      const admin = await superAdmin();
      const head = await person({
        role: "DepartmentHead",
        head_of_department: "Physics",
      });
      const res = await patch(admin, head.id, { fullName: "Renamed Head" });
      expect(res.status).toBe(200);
      expect(res.body.headOfDepartment).toBe("Physics");
    });

    it("refuses to clear the only scope of a Department Head", async () => {
      const admin = await superAdmin();
      const head = await person({ role: "DepartmentHead", head_of_department: "Physics" });
      const res = await patch(admin, head.id, { headOfDepartment: null });
      expect(res.status).toBe(422);
      expect((await userRow(head.id)).head_of_department).toBe("Physics");
    });

    it("can move a head to another department", async () => {
      const admin = await superAdmin();
      const head = await person({ role: "DepartmentHead", head_of_department: "Physics" });
      const res = await patch(admin, head.id, { headOfDepartment: "Chemistry" });
      expect(res.status).toBe(200);
      expect(res.body.headOfDepartment).toBe("Chemistry");
      expect(await auditRows("user.updated")).toHaveLength(1);
    });

    it("clears the scope when the user stops being a Department Head", async () => {
      const admin = await superAdmin();
      const head = await person({ role: "DepartmentHead", head_of_department: "Physics" });
      const res = await patch(admin, head.id, { role: "Applicant" });
      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty("headOfDepartment");
      expect((await userRow(head.id)).head_of_department).toBeNull();
    });

    it("ignores a scope sent for a role that does not use it", async () => {
      const admin = await superAdmin();
      const target = await person({ role: "Applicant" });
      const res = await patch(admin, target.id, { fullName: "Plain", headOfDepartment: "Physics" });
      expect(res.status).toBe(200);
      expect((await userRow(target.id)).head_of_department).toBeNull();
    });
  });

  it("saves nothing when a later check fails (all or nothing)", async () => {
    await seedDirectory();
    const admin = await superAdmin();
    const target = await person({ full_name: "Unchanged" });
    const res = await patch(admin, target.id, {
      fullName: "Changed",
      role: "DepartmentHead",
      headOfDepartment: "Nowhere",
    });
    expect(res.status).toBe(422);
    expect((await userRow(target.id)).full_name).toBe("Unchanged");
    expect(await auditRows()).toHaveLength(0);
    expect(await db("notifications")).toHaveLength(0);
  });

  it("records who did it, from where, and the request id", async () => {
    const admin = await superAdmin();
    const target = await person();
    await patch(admin, target.id, { fullName: "Audited" });
    const [row] = await auditRows("user.updated");
    expect(row.actor_user_id).toBe(admin.id);
    expect(row.actor_role).toBe("SuperAdmin");
    expect(row.request_id).toEqual(expect.any(String));
    expect(row.ip).toEqual(expect.any(String));
  });
});

describe("DELETE /users/:id", () => {
  it("deletes another Super Admin and everything hanging off the account", async () => {
    const admin = await superAdmin();
    const target = await superAdmin({ email: "leaving@sust.edu" });
    await createRefreshToken(target.id as string);
    await db("notifications").insert({
      id: randomUUID(),
      recipient_user_id: target.id,
      type: "Account Status Changed",
      message: "m",
      link_type: "user",
      link_id: String(target.id),
    });
    await db("otp_challenges").insert({
      id: randomUUID(),
      email: "leaving@sust.edu",
      code_hash: "x:y",
      purpose: "resume",
      expires_at: new Date(Date.now() + 60_000),
      last_sent_at: new Date(),
    });
    const file = await createFileRow(target.id);
    await db("users").where({ id: target.id }).update({ signature_file_id: file.id });

    const res = await del(admin, target.id);
    expect(res.status).toBe(204);
    expect(res.text).toBe("");

    expect(await userRow(target.id)).toBeUndefined();
    expect(await db("refresh_tokens").where({ user_id: target.id })).toHaveLength(0);
    expect(await db("notifications").where({ recipient_user_id: target.id })).toHaveLength(0);
    expect(await db("otp_challenges").where({ email: "leaving@sust.edu" })).toHaveLength(0);
    expect(await db("files").where({ owner_user_id: target.id })).toHaveLength(0);
  });

  it("writes a user.deleted audit row that keeps the account's last state", async () => {
    const admin = await superAdmin();
    const target = await superAdmin({ email: "audited@sust.edu", full_name: "Audited Admin" });
    await del(admin, target.id);

    const [row] = await auditRows("user.deleted");
    expect(row).toMatchObject({
      actor_user_id: admin.id,
      entity_type: "user",
      entity_id: target.id,
      after_json: null,
    });
    expect(row.before_json).toMatchObject({
      email: "audited@sust.edu",
      fullName: "Audited Admin",
      role: "SuperAdmin",
    });
  });

  it("invalidates the deleted user's access token", async () => {
    const admin = await superAdmin();
    const target = await superAdmin();
    const headers = auth(target);
    await del(admin, target.id);
    expect((await request(app).get(`${BASE}/users`).set(headers)).status).toBe(401);
  });

  it("refuses to delete yourself", async () => {
    const admin = await superAdmin();
    await superAdmin();
    const res = await del(admin, admin.id);
    expect(res.status).toBe(403);
    expect(await userRow(admin.id)).toBeDefined();
  });

  it.each(["Applicant", "DepartmentHead", "TransportInCharge", "TransportAdministrator"])(
    "refuses to delete a %s",
    async (role) => {
      const admin = await superAdmin();
      const target = await person({ role });
      const res = await del(admin, target.id);
      expect(res.status).toBe(403);
      expect(res.body.error.message).toBe("Only Super Admin accounts can be deleted.");
      expect(await userRow(target.id)).toBeDefined();
      expect(await auditRows()).toHaveLength(0);
    },
  );

  it("refuses when the account owns requisitions, and deletes nothing", async () => {
    const admin = await superAdmin();
    const target = await superAdmin();
    await createRequisition(target.id as string);
    await createRefreshToken(target.id as string);

    const res = await del(admin, target.id);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("USER_HAS_HISTORY");
    expect(await userRow(target.id)).toBeDefined();
    expect(await db("refresh_tokens").where({ user_id: target.id })).toHaveLength(1);
    expect(await auditRows()).toHaveLength(0);
  });

  it("returns 404 for an unknown user and 422 for a malformed id", async () => {
    const admin = await superAdmin();
    expect((await del(admin, randomUUID())).status).toBe(404);
    expect((await del(admin, "nope")).status).toBe(422);
  });

  it("can only delete once", async () => {
    const admin = await superAdmin();
    const target = await superAdmin();
    expect((await del(admin, target.id)).status).toBe(204);
    expect((await del(admin, target.id)).status).toBe(404);
  });
});

describe("the Super Admin journey (Part 2 §21 item 7)", () => {
  it("appoints, edits, promotes, deactivates and deletes accounts end to end", async () => {
    const admin = await superAdmin();

    const created = await post(admin, {
      fullName: "New Incharge",
      email: "new-incharge@sust.edu",
      role: "TransportInCharge",
      password: "a-long-enough-password",
    });
    expect(created.status).toBe(201);
    const id = created.body.id as string;

    expect((await patch(admin, id, { fullName: "Renamed Incharge" })).status).toBe(200);
    expect((await patch(admin, id, { role: "SuperAdmin" })).status).toBe(200);

    const listed = await get(admin, "?role=SuperAdmin&q=renamed");
    expect(listed.body.data.map((u: Row) => u.id)).toEqual([id]);

    expect((await patch(admin, id, { isActive: false })).status).toBe(200);
    expect((await del(admin, id)).status).toBe(204);

    expect((await auditRows()).map((r) => r.action)).toEqual([
      "user.created",
      "user.updated",
      "user.role_changed",
      "user.deactivated",
      "user.deleted",
    ]);
  });
});
