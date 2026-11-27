import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { seed as seedDirectoryUnits } from "../../seeds/01_directory_units.js";
import { db, truncateAll } from "../helpers/db.js";
import { seedDirectory } from "../helpers/session.js";

const BASE = env.API_BASE_PATH;
const app = createApp();

beforeEach(async () => {
  await truncateAll();
  await seedDirectory();
});

afterAll(async () => {
  await db.destroy();
});

describe("GET /directory/departments", () => {
  it("is public and returns the 27 seeded departments, alphabetically", async () => {
    const res = await request(app).get(`${BASE}/directory/departments`);
    expect(res.status).toBe(200);
    const names = res.body.data as string[];
    expect(names).toHaveLength(27);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(names).toContain("Computer Science and Engineering");
    expect(names).not.toContain("Central Library");
  });

  it("leaves out a department that has been switched off", async () => {
    await db("directory_units").where({ name: "Physics" }).update({ is_active: 0 });
    const res = await request(app).get(`${BASE}/directory/departments`);
    expect(res.body.data).toHaveLength(26);
    expect(res.body.data).not.toContain("Physics");
  });

  it("returns an empty list when nothing is seeded", async () => {
    await truncateAll();
    const res = await request(app).get(`${BASE}/directory/departments`);
    expect(res.body).toEqual({ data: [] });
  });
});

describe("GET /directory/offices", () => {
  it("is public and returns the 15 seeded offices, alphabetically", async () => {
    const res = await request(app).get(`${BASE}/directory/offices`);
    expect(res.status).toBe(200);
    const names = res.body.data as string[];
    expect(names).toHaveLength(15);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(names).toContain("Central Library");
    expect(names).toContain("Office of the Director, Students' Counseling and Guidance");
    expect(names).not.toContain("Physics");
  });

  it("leaves out an office that has been switched off", async () => {
    await db("directory_units").where({ name: "Medical Centre" }).update({ is_active: 0 });
    const res = await request(app).get(`${BASE}/directory/offices`);
    expect(res.body.data).toHaveLength(14);
  });
});

describe("directory seed", () => {
  it("stores the school of each department and none for offices", async () => {
    const cse = await db("directory_units")
      .where({ name: "Computer Science and Engineering" })
      .first();
    expect(cse).toMatchObject({
      kind: "Department",
      school: "School of Applied Sciences and Technology",
    });
    const library = await db("directory_units").where({ name: "Central Library" }).first();
    expect(library).toMatchObject({ kind: "Office", school: null });
  });

  it("is safe to run again: no duplicates, and a unit that was switched off stays off", async () => {
    await db("directory_units").where({ name: "Physics" }).update({ is_active: 0 });
    await seedDirectoryUnits(db);
    await seedDirectoryUnits(db);
    const total = await db("directory_units").count({ count: "*" }).first();
    expect(Number(total?.count)).toBe(42);
    const physics = await db("directory_units").where({ name: "Physics" }).first();
    expect(physics.is_active).toBe(0);
  });

  it("repairs a renamed school or changed kind for an existing name", async () => {
    await db("directory_units").where({ name: "Physics" }).update({ school: "Wrong" });
    await seedDirectoryUnits(db);
    const physics = await db("directory_units").where({ name: "Physics" }).first();
    expect(physics.school).toBe("School of Physical Sciences");
  });
});

describe("admin account seed", () => {
  const importSeed = async () => {
    vi.resetModules();
    return (await import("../../seeds/02_admin_accounts.js")) as typeof import("../../seeds/02_admin_accounts.js");
  };

  it("creates the three privileged accounts, verified and active, that can log in", async () => {
    const { seed } = await importSeed();
    await seed(db);

    const users = await db("users").orderBy("email");
    expect(users.map((u) => [u.email, u.role])).toEqual([
      ["superadmin@sust.edu", "SuperAdmin"],
      ["transport-admin@sust.edu", "TransportAdministrator"],
      ["transport-in-charge@sust.edu", "TransportInCharge"],
    ]);
    for (const user of users) {
      expect(user.is_verified).toBe(1);
      expect(user.is_active).toBe(1);
      expect(user.password_hash).toMatch(/^\$argon2id\$/);
      expect(user.password_hash).not.toContain(env.SEED_ADMIN_PASSWORD);

      const login = await request(app)
        .post(`${BASE}/auth/login`)
        .send({ email: user.email, password: env.SEED_ADMIN_PASSWORD });
      expect(login.status).toBe(200);
      expect(login.body.user).toMatchObject({ email: user.email, role: user.role });
    }
  });

  it("leaves existing accounts alone, so a changed password survives a re-seed", async () => {
    const { seed } = await importSeed();
    await seed(db);
    const before = await db("users").where({ email: "superadmin@sust.edu" }).first();
    await db("users").where({ id: before.id }).update({ password_hash: "changed-by-the-owner" });

    await seed(db);

    const after = await db("users").where({ email: "superadmin@sust.edu" }).first();
    expect(after.id).toBe(before.id);
    expect(after.password_hash).toBe("changed-by-the-owner");
    expect(await db("users").count({ count: "*" }).first()).toEqual({ count: 3 });
  });

  describe("in production", () => {
    const useProduction = (adminPassword?: string) => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("OTP_DEV_ECHO", "false");
      vi.stubEnv("COOKIE_SECURE", "true");
      if (adminPassword) vi.stubEnv("SEED_ADMIN_PASSWORD", adminPassword);
      else vi.stubEnv("SEED_ADMIN_PASSWORD", "Admin@123");
    };
    const restore = () => {
      vi.unstubAllEnvs();
      vi.resetModules();
    };

    it("refuses the well-known development password and creates nothing", async () => {
      useProduction();
      try {
        const { seed } = await importSeed();
        await expect(seed(db)).rejects.toThrow(/default SEED_ADMIN_PASSWORD/);
        expect(await db("users").count({ count: "*" }).first()).toEqual({ count: 0 });
      } finally {
        restore();
      }
    });

    it("seeds normally once a different password is configured", async () => {
      useProduction("a-long-secret-chosen-by-the-owner");
      try {
        const { seed } = await importSeed();
        await seed(db);
        expect(await db("users").count({ count: "*" }).first()).toEqual({ count: 3 });
      } finally {
        restore();
      }
    });
  });
});
