import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { conflict } from "../../src/errors/AppError.js";
import { resetRateLimitStores } from "../../src/middleware/rateLimit.js";
import { allocationGuardService } from "../../src/modules/allocationGuards/allocationGuard.service.js";
import { db, truncateAll } from "../helpers/db.js";
import { createOffDay, createUser, createVehicle } from "../helpers/factories.js";
import { bearer } from "../helpers/session.js";

const BASE = env.API_BASE_PATH;
const app = createApp();

type Row = Record<string, unknown>;

const get = (user: Row, query = "") =>
  request(app).get(`${BASE}/off-days${query}`).set(bearer(user));
const post = (user: Row, body: object = {}) =>
  request(app).post(`${BASE}/off-days`).set(bearer(user)).send(body);
const patch = (user: Row, id: unknown, body: object) =>
  request(app).patch(`${BASE}/off-days/${id}`).set(bearer(user)).send(body);
const del = (user: Row, id: unknown) =>
  request(app).delete(`${BASE}/off-days/${id}`).set(bearer(user));

const offDayRow = (id: unknown) => db("vehicle_off_days").where({ id }).first();
const auditRows = (action: string) => db("audit_logs").where({ action }).orderBy("id");

let n = 0;
const staff = (role: string) =>
  createUser({ email: `${role.toLowerCase()}${++n}@sust.edu`, role, is_verified: 1 });

beforeEach(async () => {
  vi.restoreAllMocks();
  await truncateAll();
  resetRateLimitStores();
});
afterAll(() => db.destroy());

describe("access control", () => {
  it("requires authentication", async () => {
    expect((await request(app).get(`${BASE}/off-days`)).status).toBe(401);
    expect((await request(app).post(`${BASE}/off-days`).send({})).status).toBe(401);
  });

  it.each(["Applicant", "DepartmentHead"])("gives a %s 403 everywhere", async (role) => {
    const user = await staff(role);
    const vehicle = await createVehicle();
    const offDay = await createOffDay(vehicle.id as string);
    for (const res of [
      await get(user),
      await post(user, { vehicleId: vehicle.id, type: "One-time", date: "2026-10-22" }),
      await patch(user, offDay.id, { reason: "x" }),
      await del(user, offDay.id),
    ]) {
      expect(res.status).toBe(403);
    }
    expect(await offDayRow(offDay.id)).toBeTruthy();
  });

  it.each(["TransportInCharge", "TransportAdministrator", "SuperAdmin"])(
    "lets a %s read and write",
    async (role) => {
      const user = await staff(role);
      const vehicle = await createVehicle();
      expect((await get(user)).status).toBe(200);
      const created = await post(user, {
        vehicleId: vehicle.id,
        type: "Recurring",
        weekday: "Fri",
      });
      expect(created.status).toBe(201);
      expect((await patch(user, created.body.id, { reason: "Service" })).status).toBe(200);
      expect((await del(user, created.body.id)).status).toBe(204);
    },
  );
});

describe("create", () => {
  it("creates a one-time off-day with only the fields that apply", async () => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    const res = await post(user, {
      vehicleId: vehicle.id,
      type: "One-time",
      date: "2026-10-22",
      reason: "  Annual inspection ",
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      vehicleId: vehicle.id,
      type: "One-time",
      date: "2026-10-22",
      reason: "Annual inspection",
    });
    expect(await offDayRow(res.body.id)).toMatchObject({
      type: "One-time",
      off_date: "2026-10-22",
      weekday: null,
    });
  });

  it("creates a recurring off-day without a reason", async () => {
    const user = await staff("TransportAdministrator");
    const vehicle = await createVehicle();
    const res = await post(user, { vehicleId: vehicle.id, type: "Recurring", weekday: "Fri" });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      vehicleId: vehicle.id,
      type: "Recurring",
      weekday: "Fri",
    });
    expect(await offDayRow(res.body.id)).toMatchObject({
      type: "Recurring",
      off_date: null,
      weekday: "Fri",
      reason: null,
    });
  });

  it("allows a date in the past", async () => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    const res = await post(user, { vehicleId: vehicle.id, type: "One-time", date: "2020-01-01" });
    expect(res.status).toBe(201);
  });

  it("writes an audit row with the new off-day and the actor", async () => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    const res = await post(user, { vehicleId: vehicle.id, type: "Recurring", weekday: "Sat" });
    const [row, ...rest] = await auditRows("off_day.created");
    expect(rest).toHaveLength(0);
    expect(row).toMatchObject({
      entity_type: "off_day",
      entity_id: res.body.id,
      actor_user_id: user.id,
      actor_role: "TransportInCharge",
    });
    expect(row.before_json).toBeNull();
    expect(row.after_json).toMatchObject({
      vehicleId: vehicle.id,
      type: "Recurring",
      weekday: "Sat",
      date: null,
    });
  });

  it.each([
    ["one-time without a date", { type: "One-time" }, "date"],
    [
      "one-time with a weekday",
      { type: "One-time", date: "2026-10-22", weekday: "Thu" },
      "weekday",
    ],
    ["recurring without a weekday", { type: "Recurring" }, "weekday"],
    ["recurring with a date", { type: "Recurring", weekday: "Thu", date: "2026-10-22" }, "date"],
    ["an impossible date", { type: "One-time", date: "2026-02-30" }, "date"],
    ["a date in the wrong format", { type: "One-time", date: "22/10/2026" }, "date"],
    ["an unknown weekday", { type: "Recurring", weekday: "Funday" }, "weekday"],
    ["an unknown type", { type: "Weekly", weekday: "Thu" }, "type"],
    ["a missing type", { date: "2026-10-22" }, "type"],
    ["an unknown key", { type: "One-time", date: "2026-10-22", reservedFor: "x" }, "reservedFor"],
    [
      "a too-long reason",
      { type: "One-time", date: "2026-10-22", reason: "x".repeat(256) },
      "reason",
    ],
  ])("rejects %s with 422 and the field in details.path", async (_name, body, path) => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    const res = await post(user, { vehicleId: vehicle.id, ...body });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toContain(path);
    expect(await db("vehicle_off_days").count({ c: "*" }).first()).toMatchObject({ c: 0 });
  });

  it("rejects an unknown or malformed vehicle id with 422", async () => {
    const user = await staff("TransportInCharge");
    for (const vehicleId of [randomUUID(), "not-a-uuid"]) {
      const res = await post(user, { vehicleId, type: "One-time", date: "2026-10-22" });
      expect(res.status).toBe(422);
      expect(res.body.error.details[0].path).toBe("vehicleId");
    }
  });
});

describe("list", () => {
  it("returns every off-day oldest first, and an empty list when there are none", async () => {
    const user = await staff("TransportInCharge");
    expect((await get(user)).body).toEqual({ data: [] });

    const vehicle = await createVehicle();
    const first = await createOffDay(vehicle.id as string, { created_at: "2026-01-01 10:00:00" });
    const second = await createOffDay(vehicle.id as string, {
      type: "Recurring",
      off_date: null,
      weekday: "Thu",
      reason: "Service",
      created_at: "2026-01-02 10:00:00",
    });
    const res = await get(user);
    expect(res.status).toBe(200);
    expect(res.body.data.map((d: { id: string }) => d.id)).toEqual([first.id, second.id]);
    expect(res.body.data[1]).toEqual({
      id: second.id,
      vehicleId: vehicle.id,
      type: "Recurring",
      weekday: "Thu",
      reason: "Service",
    });
  });

  it("filters by vehicle", async () => {
    const user = await staff("TransportInCharge");
    const a = await createVehicle();
    const b = await createVehicle();
    const offA = await createOffDay(a.id as string);
    await createOffDay(b.id as string);
    const res = await get(user, `?vehicleId=${a.id}`);
    expect(res.body.data.map((d: { id: string }) => d.id)).toEqual([offA.id]);
    expect((await get(user, `?vehicleId=${randomUUID()}`)).body.data).toEqual([]);
    expect((await get(user, "?vehicleId=nope")).status).toBe(422);
  });

  it("filters one-time off-days by date range and keeps recurring ones that can occur in it", async () => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    const vid = vehicle.id as string;
    const early = await createOffDay(vid, { off_date: "2026-10-05" });
    const inside = await createOffDay(vid, { off_date: "2026-10-22" });
    const late = await createOffDay(vid, { off_date: "2026-11-30" });
    // 2026-10-22 is a Thursday; 2026-10-23 a Friday.
    const thursdays = await createOffDay(vid, {
      type: "Recurring",
      off_date: null,
      weekday: "Thu",
    });
    const fridays = await createOffDay(vid, { type: "Recurring", off_date: null, weekday: "Fri" });

    const ids = async (query: string) =>
      (await get(user, query)).body.data.map((d: { id: string }) => d.id).sort();
    const sorted = (...rows: Row[]) => rows.map((r) => r.id as string).sort();

    expect(await ids("?from=2026-10-22&to=2026-10-22")).toEqual(sorted(inside, thursdays));
    expect(await ids("?from=2026-10-10&to=2026-10-31")).toEqual(sorted(inside, thursdays, fridays));
    expect(await ids("?from=2026-10-23")).toEqual(sorted(late, thursdays, fridays));
    expect(await ids("?to=2026-10-05")).toEqual(sorted(early, thursdays, fridays));
    expect(await ids("?from=2026-10-23&to=2026-10-23")).toEqual(sorted(fridays));
  });

  it("rejects an inverted range and a bad date with 422", async () => {
    const user = await staff("TransportInCharge");
    expect((await get(user, "?from=2026-10-02&to=2026-10-01")).status).toBe(422);
    expect((await get(user, "?from=2026-02-30")).status).toBe(422);
    expect((await get(user, "?page=2")).status).toBe(422);
  });
});

describe("update", () => {
  it("changes the reason, and clears it with null or a blank", async () => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    const offDay = await createOffDay(vehicle.id as string, { reason: "Old" });

    const changed = await patch(user, offDay.id, { reason: " New reason " });
    expect(changed.status).toBe(200);
    expect(changed.body.reason).toBe("New reason");

    const cleared = await patch(user, offDay.id, { reason: "  " });
    expect(cleared.status).toBe(200);
    expect(cleared.body).not.toHaveProperty("reason");
    expect((await offDayRow(offDay.id))?.reason).toBeNull();
  });

  it("changes the date of a one-time off-day and the weekday of a recurring one", async () => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    const oneTime = await createOffDay(vehicle.id as string);
    const recurring = await createOffDay(vehicle.id as string, {
      type: "Recurring",
      off_date: null,
      weekday: "Mon",
    });
    expect((await patch(user, oneTime.id, { date: "2026-11-01" })).body.date).toBe("2026-11-01");
    expect((await patch(user, recurring.id, { weekday: "Tue" })).body.weekday).toBe("Tue");
  });

  it("switches type when the new type's field comes with it, dropping the old field", async () => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    const oneTime = await createOffDay(vehicle.id as string);

    const toRecurring = await patch(user, oneTime.id, { type: "Recurring", weekday: "Sun" });
    expect(toRecurring.status).toBe(200);
    expect(toRecurring.body).toMatchObject({ type: "Recurring", weekday: "Sun" });
    expect(toRecurring.body).not.toHaveProperty("date");
    expect(await offDayRow(oneTime.id)).toMatchObject({ type: "Recurring", off_date: null });

    const back = await patch(user, oneTime.id, { type: "One-time", date: "2026-12-01" });
    expect(back.status).toBe(200);
    expect(back.body).toMatchObject({ type: "One-time", date: "2026-12-01" });
    expect(back.body).not.toHaveProperty("weekday");
    expect(await offDayRow(oneTime.id)).toMatchObject({ weekday: null, off_date: "2026-12-01" });
  });

  it.each([
    ["switching to recurring without a weekday", { type: "Recurring" }, "weekday"],
    ["switching to one-time without a date", { type: "One-time" }, "date"],
    ["a weekday on a one-time off-day", { weekday: "Mon" }, "weekday"],
    [
      "a date together with the switch to recurring",
      { type: "Recurring", date: "2026-10-22", weekday: "Mon" },
      "date",
    ],
  ])("rejects %s with 422 and leaves the row alone", async (_name, body, path) => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    const offDay = await createOffDay(vehicle.id as string);
    // "switching to one-time" needs a recurring row to start from.
    const target =
      "type" in body && body.type === "One-time"
        ? await createOffDay(vehicle.id as string, {
            type: "Recurring",
            off_date: null,
            weekday: "Mon",
          })
        : offDay;
    const before = await offDayRow(target.id);
    const res = await patch(user, target.id, body);
    expect(res.status).toBe(422);
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toContain(path);
    expect(await offDayRow(target.id)).toEqual(before);
    expect(await auditRows("off_day.updated")).toHaveLength(0);
  });

  it("rejects a vehicle id and unknown keys with 422", async () => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    const offDay = await createOffDay(vehicle.id as string);
    expect((await patch(user, offDay.id, { vehicleId: randomUUID() })).status).toBe(422);
    expect((await patch(user, offDay.id, { color: "red" })).status).toBe(422);
  });

  it("returns 404 for an unknown id and 422 for a malformed one", async () => {
    const user = await staff("TransportInCharge");
    expect((await patch(user, randomUUID(), { reason: "x" })).status).toBe(404);
    expect((await patch(user, "nope", { reason: "x" })).status).toBe(422);
  });

  it("writes nothing when nothing changes", async () => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    const offDay = await createOffDay(vehicle.id as string, { reason: "Same" });
    for (const body of [{}, { reason: "Same" }, { date: "2026-10-22" }, { type: "One-time" }]) {
      expect((await patch(user, offDay.id, body)).status).toBe(200);
    }
    expect(await auditRows("off_day.updated")).toHaveLength(0);
  });

  it("writes an audit row with before and after", async () => {
    const user = await staff("TransportAdministrator");
    const vehicle = await createVehicle();
    const offDay = await createOffDay(vehicle.id as string, { reason: "Old" });
    await patch(user, offDay.id, { date: "2026-11-05", reason: "New" });
    const [row, ...rest] = await auditRows("off_day.updated");
    expect(rest).toHaveLength(0);
    expect(row).toMatchObject({ entity_id: offDay.id, actor_user_id: user.id });
    expect(row.before_json).toMatchObject({ date: "2026-10-22", reason: "Old" });
    expect(row.after_json).toMatchObject({ date: "2026-11-05", reason: "New" });
  });
});

describe("delete", () => {
  it("deletes the off-day and writes an audit row with the old values", async () => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    const offDay = await createOffDay(vehicle.id as string, { reason: "Service" });
    const res = await del(user, offDay.id);
    expect(res.status).toBe(204);
    expect(await offDayRow(offDay.id)).toBeUndefined();
    const [row] = await auditRows("off_day.deleted");
    expect(row).toMatchObject({ entity_id: offDay.id, actor_user_id: user.id });
    expect(row.before_json).toMatchObject({ vehicleId: vehicle.id, reason: "Service" });
    expect(row.after_json).toBeNull();
  });

  it("returns 404 the second time and for an unknown id, 422 for a malformed one", async () => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    const offDay = await createOffDay(vehicle.id as string);
    expect((await del(user, offDay.id)).status).toBe(204);
    expect((await del(user, offDay.id)).status).toBe(404);
    expect((await del(user, randomUUID())).status).toBe(404);
    expect((await del(user, "nope")).status).toBe(422);
  });

  it("leaves other off-days alone, and removing a vehicle removes its off-days", async () => {
    const user = await staff("TransportInCharge");
    const a = await createVehicle();
    const b = await createVehicle();
    const offA = await createOffDay(a.id as string);
    const offB = await createOffDay(b.id as string);
    await del(user, offA.id);
    expect(await offDayRow(offB.id)).toBeTruthy();

    const vehicleDelete = await request(app).delete(`${BASE}/vehicles/${b.id}`).set(bearer(user));
    expect(vehicleDelete.status).toBe(204);
    expect(await offDayRow(offB.id)).toBeUndefined();
  });
});

describe("allocation guard", () => {
  const spy = () => vi.spyOn(allocationGuardService, "assertOffDayAllowed");

  it("runs before a create and before an effective update, with the resulting off-day", async () => {
    const guard = spy();
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();

    const created = await post(user, {
      vehicleId: vehicle.id,
      type: "One-time",
      date: "2026-10-22",
    });
    expect(guard).toHaveBeenLastCalledWith(
      vehicle.id,
      { type: "One-time", date: "2026-10-22", weekday: null },
      expect.anything(),
    );

    await patch(user, created.body.id, { type: "Recurring", weekday: "Mon" });
    expect(guard).toHaveBeenLastCalledWith(
      vehicle.id,
      { type: "Recurring", date: null, weekday: "Mon" },
      expect.anything(),
    );
    expect(guard).toHaveBeenCalledTimes(2);
  });

  it("does not run for a reason-only no-op, nor for a delete", async () => {
    const guard = spy();
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    const offDay = await createOffDay(vehicle.id as string, { reason: "Same" });
    await patch(user, offDay.id, { reason: "Same" });
    await del(user, offDay.id);
    expect(guard).not.toHaveBeenCalled();
  });

  it("refuses a create and keeps nothing when the guard throws (rolled back, no audit)", async () => {
    spy().mockRejectedValue(conflict("CONFLICT", "Clashes with allocations"));
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    const res = await post(user, { vehicleId: vehicle.id, type: "One-time", date: "2026-10-22" });
    expect(res.status).toBe(409);
    expect(await db("vehicle_off_days").count({ c: "*" }).first()).toMatchObject({ c: 0 });
    expect(await auditRows("off_day.created")).toHaveLength(0);
  });

  it("refuses an update and leaves the off-day unchanged when the guard throws", async () => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    const offDay = await createOffDay(vehicle.id as string);
    spy().mockRejectedValue(conflict("CONFLICT", "Clashes with allocations"));
    const res = await patch(user, offDay.id, { date: "2026-11-11" });
    expect(res.status).toBe(409);
    expect((await offDayRow(offDay.id))?.off_date).toBe("2026-10-22");
    expect(await auditRows("off_day.updated")).toHaveLength(0);
  });
});

describe("vehicle detail", () => {
  it("lists the vehicle's off-days on GET /vehicles/:id, and an empty array when it has none", async () => {
    const user = await staff("TransportInCharge");
    const withDays = await createVehicle();
    const without = await createVehicle();
    const other = await createVehicle();
    const oneTime = await createOffDay(withDays.id as string, {
      created_at: "2026-01-01 00:00:00",
    });
    const recurring = await createOffDay(withDays.id as string, {
      type: "Recurring",
      off_date: null,
      weekday: "Fri",
      reason: "Friday service",
      created_at: "2026-01-02 00:00:00",
    });
    await createOffDay(other.id as string);

    const res = await request(app).get(`${BASE}/vehicles/${withDays.id}`).set(bearer(user));
    expect(res.status).toBe(200);
    expect(res.body.offDays).toEqual([
      { id: oneTime.id, vehicleId: withDays.id, type: "One-time", date: "2026-10-22" },
      {
        id: recurring.id,
        vehicleId: withDays.id,
        type: "Recurring",
        weekday: "Fri",
        reason: "Friday service",
      },
    ]);

    const empty = await request(app).get(`${BASE}/vehicles/${without.id}`).set(bearer(user));
    expect(empty.body.offDays).toEqual([]);
  });
});
