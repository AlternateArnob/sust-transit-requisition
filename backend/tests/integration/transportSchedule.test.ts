import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { conflict } from "../../src/errors/AppError.js";
import { resetRateLimitStores } from "../../src/middleware/rateLimit.js";
import { allocationGuardService } from "../../src/modules/allocationGuards/allocationGuard.service.js";
import { db, truncateAll } from "../helpers/db.js";
import {
  createAllocation,
  createOffDay,
  createRequisition,
  createScenario,
  createScheduleEntry,
  createTrip,
  createUser,
  createVehicle,
} from "../helpers/factories.js";
import { bearer } from "../helpers/session.js";

const BASE = env.API_BASE_PATH;
const app = createApp();

type Row = Record<string, unknown>;

const list = (user: Row) => request(app).get(`${BASE}/transport-schedule`).set(bearer(user));
const put = (user: Row, vehicleId: unknown, body: object) =>
  request(app).put(`${BASE}/transport-schedule/${vehicleId}`).set(bearer(user)).send(body);
const del = (user: Row, vehicleId: unknown) =>
  request(app).delete(`${BASE}/transport-schedule/${vehicleId}`).set(bearer(user));
const lookup = (user: Row, query = "") =>
  request(app).get(`${BASE}/schedule/lookup${query}`).set(bearer(user));

const slots = async (entryId: unknown) =>
  db("student_transport_slots").where({ entry_id: entryId }).orderBy("weekday");
const entries = () => db("student_transport_vehicles").select("*");
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
  it("requires authentication on every route", async () => {
    const id = randomUUID();
    expect((await request(app).get(`${BASE}/transport-schedule`)).status).toBe(401);
    expect(
      (await request(app).put(`${BASE}/transport-schedule/${id}`).send({ schedule: {} })).status,
    ).toBe(401);
    expect((await request(app).delete(`${BASE}/transport-schedule/${id}`)).status).toBe(401);
    expect((await request(app).get(`${BASE}/schedule/lookup?date=2026-10-22`)).status).toBe(401);
  });

  it.each(["Applicant", "DepartmentHead"])("gives a %s 403 everywhere", async (role) => {
    const user = await staff(role);
    const vehicle = await createVehicle();
    await createScheduleEntry(vehicle.id as string, { Mon: "18:50" });
    for (const res of [
      await list(user),
      await put(user, vehicle.id, { schedule: { Mon: "17:00" } }),
      await del(user, vehicle.id),
      await lookup(user, "?date=2026-10-22"),
    ]) {
      expect(res.status).toBe(403);
    }
    expect(await entries()).toHaveLength(1);
  });

  it.each(["TransportInCharge", "TransportAdministrator", "SuperAdmin"])(
    "lets a %s read, write and look up",
    async (role) => {
      const user = await staff(role);
      const vehicle = await createVehicle();
      expect((await list(user)).status).toBe(200);
      expect((await put(user, vehicle.id, { schedule: { Mon: "18:50" } })).status).toBe(201);
      expect((await lookup(user, "?date=2026-10-22")).status).toBe(200);
      expect((await del(user, vehicle.id)).status).toBe(204);
    },
  );
});

describe("PUT /transport-schedule/:vehicleId", () => {
  it("creates an entry (201) and stores one slot per weekday as TIME", async () => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    const res = await put(user, vehicle.id, { schedule: { Thu: "17:00", Mon: "18:50" } });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      vehicleId: vehicle.id,
      schedule: { Mon: "18:50", Thu: "17:00" },
    });
    expect(await slots(res.body.id)).toEqual([
      { entry_id: res.body.id, weekday: "Mon", free_after: "18:50:00" },
      { entry_id: res.body.id, weekday: "Thu", free_after: "17:00:00" },
    ]);
  });

  it("ignores weekdays sent as an empty string or null (free all day)", async () => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    const res = await put(user, vehicle.id, { schedule: { Mon: "18:50", Tue: "", Wed: null } });
    expect(res.status).toBe(201);
    expect(res.body.schedule).toEqual({ Mon: "18:50" });
    expect(await slots(res.body.id)).toHaveLength(1);
  });

  it("replaces the whole schedule: same entry id, removed weekdays lose their slot (200)", async () => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    const created = await put(user, vehicle.id, {
      schedule: { Mon: "18:50", Tue: "17:00", Wed: "16:00" },
    });

    const replaced = await put(user, vehicle.id, { schedule: { Mon: "19:30", Sat: "12:00" } });
    expect(replaced.status).toBe(200);
    expect(replaced.body).toEqual({
      id: created.body.id,
      vehicleId: vehicle.id,
      schedule: { Mon: "19:30", Sat: "12:00" },
    });
    expect((await slots(created.body.id)).map((s) => [s.weekday, s.free_after])).toEqual([
      ["Mon", "19:30:00"],
      ["Sat", "12:00:00"],
    ]);
    expect(await entries()).toHaveLength(1);
  });

  it("keeps schedules of different vehicles apart", async () => {
    const user = await staff("TransportInCharge");
    const a = await createVehicle();
    const b = await createVehicle();
    await put(user, a.id, { schedule: { Mon: "18:50" } });
    await put(user, b.id, { schedule: { Mon: "17:00" } });
    await put(user, a.id, { schedule: { Tue: "10:00" } });
    const rows = (await list(user)).body.data as { vehicleId: string; schedule: object }[];
    expect(rows.find((r) => r.vehicleId === b.id)?.schedule).toEqual({ Mon: "17:00" });
    expect(rows.find((r) => r.vehicleId === a.id)?.schedule).toEqual({ Tue: "10:00" });
  });

  it("writes nothing when the schedule is unchanged", async () => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    const created = await put(user, vehicle.id, { schedule: { Mon: "18:50", Thu: "17:00" } });
    const before = await db("student_transport_vehicles").where({ id: created.body.id }).first();

    const again = await put(user, vehicle.id, {
      schedule: { Thu: "17:00", Mon: "18:50", Fri: "" },
    });
    expect(again.status).toBe(200);
    expect(again.body).toEqual(created.body);
    expect(await auditRows("transport_schedule.updated")).toHaveLength(0);
    expect(await db("student_transport_vehicles").where({ id: created.body.id }).first()).toEqual(
      before,
    );
  });

  it("writes audit rows for create and replace, with before and after", async () => {
    const user = await staff("TransportAdministrator");
    const vehicle = await createVehicle();
    const created = await put(user, vehicle.id, { schedule: { Mon: "18:50" } });
    await put(user, vehicle.id, { schedule: { Mon: "19:00", Tue: "10:00" } });

    const [createdRow] = await auditRows("transport_schedule.created");
    expect(createdRow).toMatchObject({
      entity_type: "transport_schedule",
      entity_id: created.body.id,
      actor_user_id: user.id,
      actor_role: "TransportAdministrator",
    });
    expect(createdRow.before_json).toBeNull();
    expect(createdRow.after_json).toEqual({ vehicleId: vehicle.id, schedule: { Mon: "18:50" } });

    const [updatedRow, ...rest] = await auditRows("transport_schedule.updated");
    expect(rest).toHaveLength(0);
    expect(updatedRow.before_json).toEqual({ vehicleId: vehicle.id, schedule: { Mon: "18:50" } });
    expect(updatedRow.after_json).toEqual({
      vehicleId: vehicle.id,
      schedule: { Mon: "19:00", Tue: "10:00" },
    });
  });

  it("returns 404 for an unknown vehicle and 422 for a malformed id", async () => {
    const user = await staff("TransportInCharge");
    expect((await put(user, randomUUID(), { schedule: { Mon: "18:50" } })).status).toBe(404);
    expect((await put(user, "nope", { schedule: { Mon: "18:50" } })).status).toBe(422);
    expect(await entries()).toHaveLength(0);
  });

  it.each([
    ["an empty schedule", { schedule: {} }, "schedule"],
    ["only blank weekdays", { schedule: { Mon: "", Tue: null } }, "schedule"],
    ["a missing schedule", {}, "schedule"],
    ["an hour past 23", { schedule: { Mon: "24:00" } }, "schedule.Mon"],
    ["minutes past 59", { schedule: { Mon: "18:60" } }, "schedule.Mon"],
    ["a time without a leading zero", { schedule: { Mon: "9:00" } }, "schedule.Mon"],
    ["a time with seconds", { schedule: { Mon: "09:00:00" } }, "schedule.Mon"],
    ["a non-string time", { schedule: { Mon: 900 } }, "schedule.Mon"],
    ["a full weekday name", { schedule: { Monday: "18:50" } }, "schedule.Monday"],
    ["an unknown top-level key", { schedule: { Mon: "18:50" }, notes: "x" }, "notes"],
  ])("rejects %s with 422 and the field in details.path", async (_name, body, path) => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    const res = await put(user, vehicle.id, body);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toContain(path);
    expect(await entries()).toHaveLength(0);
  });

  it("keeps the old schedule when a replacement is invalid", async () => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    const created = await put(user, vehicle.id, { schedule: { Mon: "18:50" } });
    expect((await put(user, vehicle.id, { schedule: { Mon: "99:99" } })).status).toBe(422);
    expect((await slots(created.body.id)).map((s) => s.free_after)).toEqual(["18:50:00"]);
  });
});

describe("GET /transport-schedule", () => {
  it("returns an empty list when there are no entries", async () => {
    const user = await staff("TransportInCharge");
    expect((await list(user)).body).toEqual({ data: [] });
  });

  it("returns every entry ordered by registration number, weekdays in Sun..Sat order", async () => {
    const user = await staff("TransportInCharge");
    const second = await createVehicle({ registration_number: "B-2" });
    const first = await createVehicle({ registration_number: "A-1" });
    await createVehicle({ registration_number: "C-3" }); // no entry
    const entryB = await createScheduleEntry(second.id as string, { Sat: "12:00", Sun: "08:00" });
    const entryA = await createScheduleEntry(first.id as string, { Wed: "16:30" });

    const res = await list(user);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { id: entryA.id, vehicleId: first.id, schedule: { Wed: "16:30" } },
      { id: entryB.id, vehicleId: second.id, schedule: { Sun: "08:00", Sat: "12:00" } },
    ]);
    expect(Object.keys(res.body.data[1].schedule)).toEqual(["Sun", "Sat"]);
  });
});

describe("DELETE /transport-schedule/:vehicleId", () => {
  it("removes the entry and its slots and writes an audit row with the old schedule", async () => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    const other = await createVehicle();
    const entry = await createScheduleEntry(vehicle.id as string, { Mon: "18:50", Tue: "17:00" });
    await createScheduleEntry(other.id as string, { Mon: "10:00" });

    expect((await del(user, vehicle.id)).status).toBe(204);
    expect(await slots(entry.id)).toHaveLength(0);
    expect(await entries()).toHaveLength(1);

    const [row] = await auditRows("transport_schedule.deleted");
    expect(row).toMatchObject({ entity_id: entry.id, actor_user_id: user.id });
    expect(row.before_json).toEqual({
      vehicleId: vehicle.id,
      schedule: { Mon: "18:50", Tue: "17:00" },
    });
    expect(row.after_json).toBeNull();
  });

  it("returns 404 when the vehicle has no entry (also the second time) or does not exist", async () => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    expect((await del(user, vehicle.id)).status).toBe(404);
    await createScheduleEntry(vehicle.id as string, { Mon: "18:50" });
    expect((await del(user, vehicle.id)).status).toBe(204);
    expect((await del(user, vehicle.id)).status).toBe(404);
    expect((await del(user, randomUUID())).status).toBe(404);
    expect((await del(user, "nope")).status).toBe(422);
  });

  it("lets the vehicle get a new entry afterwards", async () => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    await put(user, vehicle.id, { schedule: { Mon: "18:50" } });
    await del(user, vehicle.id);
    expect((await put(user, vehicle.id, { schedule: { Tue: "10:00" } })).status).toBe(201);
  });

  it("is removed together with its vehicle", async () => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    const entry = await createScheduleEntry(vehicle.id as string, { Mon: "18:50" });
    expect(
      (await request(app).delete(`${BASE}/vehicles/${vehicle.id}`).set(bearer(user))).status,
    ).toBe(204);
    expect(await entries()).toHaveLength(0);
    expect(await slots(entry.id)).toHaveLength(0);
  });
});

describe("allocation guard", () => {
  const spy = () => vi.spyOn(allocationGuardService, "assertScheduleAllowed");

  it("runs before a create and a replace, with the new schedule", async () => {
    const guard = spy();
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    await put(user, vehicle.id, { schedule: { Mon: "18:50" } });
    expect(guard).toHaveBeenLastCalledWith(vehicle.id, { Mon: "18:50" }, expect.anything());
    await put(user, vehicle.id, { schedule: { Mon: "19:00", Fri: "08:00" } });
    expect(guard).toHaveBeenLastCalledWith(
      vehicle.id,
      { Mon: "19:00", Fri: "08:00" },
      expect.anything(),
    );
    expect(guard).toHaveBeenCalledTimes(2);
  });

  it("does not run for an unchanged schedule, nor for a delete", async () => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    await createScheduleEntry(vehicle.id as string, { Mon: "18:50" });
    const guard = spy();
    await put(user, vehicle.id, { schedule: { Mon: "18:50" } });
    await del(user, vehicle.id);
    expect(guard).not.toHaveBeenCalled();
  });

  it("refuses a create and keeps nothing when the guard throws", async () => {
    spy().mockRejectedValue(conflict("CONFLICT", "Clashes with allocations"));
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    const res = await put(user, vehicle.id, { schedule: { Mon: "18:50" } });
    expect(res.status).toBe(409);
    expect(await entries()).toHaveLength(0);
    expect(await auditRows("transport_schedule.created")).toHaveLength(0);
  });

  it("refuses a replace and keeps the old schedule when the guard throws", async () => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    const entry = await createScheduleEntry(vehicle.id as string, { Mon: "18:50" });
    spy().mockRejectedValue(conflict("CONFLICT", "Clashes with allocations"));
    const res = await put(user, vehicle.id, { schedule: { Mon: "22:00", Tue: "10:00" } });
    expect(res.status).toBe(409);
    expect((await slots(entry.id)).map((s) => [s.weekday, s.free_after])).toEqual([
      ["Mon", "18:50:00"],
    ]);
    expect(await auditRows("transport_schedule.updated")).toHaveLength(0);
  });
});

describe("concurrency", () => {
  it("two simultaneous PUTs for a new vehicle leave exactly one entry with one request's schedule", async () => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    const results = await Promise.all([
      put(user, vehicle.id, { schedule: { Mon: "18:50" } }),
      put(user, vehicle.id, { schedule: { Tue: "17:00" } }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 201]);
    const stored = await entries();
    expect(stored).toHaveLength(1);
    const rows = await slots(stored[0].id);
    expect(rows).toHaveLength(1);
    expect(["Mon", "Tue"]).toContain(rows[0].weekday);
  });
});

describe("GET /schedule/lookup", () => {
  // 2026-10-22 is a Thursday.
  const DATE = "2026-10-22";

  it("requires a real date", async () => {
    const user = await staff("TransportInCharge");
    for (const query of ["", "?date=", "?date=tomorrow", "?date=2026-02-30", "?date=22-10-2026"]) {
      const res = await lookup(user, query);
      expect(res.status, query).toBe(422);
    }
    expect((await lookup(user, `?date=${DATE}&vehicleId=x`)).status).toBe(422);
  });

  it("returns the date, its weekday and an empty list when there are no vehicles", async () => {
    const user = await staff("TransportInCharge");
    const res = await lookup(user, `?date=${DATE}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ date: DATE, weekday: "Thu", data: [] });
  });

  it("lists every vehicle ordered by registration with nothing flagged when it is free", async () => {
    const user = await staff("TransportInCharge");
    const b = await createVehicle({ registration_number: "B-2" });
    const a = await createVehicle({ registration_number: "A-1" });
    const res = await lookup(user, `?date=${DATE}`);
    expect(res.body.data).toEqual([
      { vehicleId: a.id, registrationNumber: "A-1", onOffDay: false, allocations: [] },
      { vehicleId: b.id, registrationNumber: "B-2", onOffDay: false, allocations: [] },
    ]);
  });

  it("flags a one-time off-day only on its date", async () => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    const offDay = await createOffDay(vehicle.id as string, {
      off_date: DATE,
      reason: "Inspection",
    });

    const on = (await lookup(user, `?date=${DATE}`)).body.data[0];
    expect(on.onOffDay).toBe(true);
    expect(on.offDayInfo).toEqual({
      id: offDay.id,
      vehicleId: vehicle.id,
      type: "One-time",
      date: DATE,
      reason: "Inspection",
    });
    expect((await lookup(user, "?date=2026-10-23")).body.data[0].onOffDay).toBe(false);
  });

  it("flags a recurring off-day on every date with that weekday", async () => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    await createOffDay(vehicle.id as string, { type: "Recurring", off_date: null, weekday: "Thu" });
    for (const date of [DATE, "2026-10-29", "2027-01-07"]) {
      expect((await lookup(user, `?date=${date}`)).body.data[0].onOffDay, date).toBe(true);
    }
    const friday = (await lookup(user, "?date=2026-10-23")).body.data[0];
    expect(friday.onOffDay).toBe(false);
    expect(friday).not.toHaveProperty("offDayInfo");
  });

  it("does not mix up off-days of different vehicles", async () => {
    const user = await staff("TransportInCharge");
    const a = await createVehicle({ registration_number: "A-1" });
    await createVehicle({ registration_number: "B-2" });
    await createOffDay(a.id as string, { off_date: DATE });
    const data = (await lookup(user, `?date=${DATE}`)).body.data;
    expect(data.map((v: { onOffDay: boolean }) => v.onOffDay)).toEqual([true, false]);
  });

  it("shows the student-transport free-after time for that weekday only", async () => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle({ registration_number: "A-1" });
    await createVehicle({ registration_number: "B-2" });
    await createScheduleEntry(vehicle.id as string, { Thu: "17:00", Mon: "18:50" });

    const thursday = (await lookup(user, `?date=${DATE}`)).body.data;
    expect(thursday[0].studentTransportFreeAfter).toBe("17:00");
    expect(thursday[1]).not.toHaveProperty("studentTransportFreeAfter");

    const monday = (await lookup(user, "?date=2026-10-26")).body.data;
    expect(monday[0].studentTransportFreeAfter).toBe("18:50");

    const friday = (await lookup(user, "?date=2026-10-23")).body.data;
    expect(friday[0]).not.toHaveProperty("studentTransportFreeAfter");
  });

  it("lists the allocations of that date, earliest first, as HH:mm with the purpose", async () => {
    const user = await staff("TransportInCharge");
    const { requester, admin, vehicle, requisition, trip } = await createScenario();
    const second = await createTrip(requisition.id as string, {
      position: 1,
      start_time: "13:00",
      end_time: "15:30",
    });
    await createAllocation(
      {
        requisitionId: requisition.id as string,
        tripId: second.id as string,
        vehicleId: vehicle.id as string,
        allocatedBy: admin.id as string,
      },
      { start_time: "13:00", end_time: "15:30" },
    );
    await createAllocation({
      requisitionId: requisition.id as string,
      tripId: trip.id as string,
      vehicleId: vehicle.id as string,
      allocatedBy: admin.id as string,
    });

    // Another date and another vehicle must not show up.
    const otherVehicle = await createVehicle();
    const otherRequisition = await createRequisition(requester.id as string, {
      purpose: "Other trip",
    });
    const otherTrip = await createTrip(otherRequisition.id as string, { trip_date: "2026-10-23" });
    await createAllocation(
      {
        requisitionId: otherRequisition.id as string,
        tripId: otherTrip.id as string,
        vehicleId: vehicle.id as string,
        allocatedBy: admin.id as string,
      },
      { alloc_date: "2026-10-23" },
    );

    const res = await lookup(user, `?date=${DATE}`);
    const mine = res.body.data.find((v: { vehicleId: unknown }) => v.vehicleId === vehicle.id);
    expect(mine.allocations).toEqual([
      {
        tripId: trip.id,
        requisitionId: requisition.id,
        startTime: "09:00",
        endTime: "11:00",
        purpose: "Test purpose",
      },
      {
        tripId: second.id,
        requisitionId: requisition.id,
        startTime: "13:00",
        endTime: "15:30",
        purpose: "Test purpose",
      },
    ]);
    const theirs = res.body.data.find(
      (v: { vehicleId: unknown }) => v.vehicleId === otherVehicle.id,
    );
    expect(theirs.allocations).toEqual([]);
  });

  it("combines everything for one vehicle on one date", async () => {
    const user = await staff("TransportAdministrator");
    const { admin, vehicle, requisition, trip } = await createScenario();
    await createOffDay(vehicle.id as string, { type: "Recurring", off_date: null, weekday: "Thu" });
    await createScheduleEntry(vehicle.id as string, { Thu: "08:30" });
    await createAllocation({
      requisitionId: requisition.id as string,
      tripId: trip.id as string,
      vehicleId: vehicle.id as string,
      allocatedBy: admin.id as string,
    });
    const [only] = (await lookup(user, `?date=${DATE}`)).body.data;
    expect(only).toMatchObject({
      vehicleId: vehicle.id,
      onOffDay: true,
      studentTransportFreeAfter: "08:30",
    });
    expect(only.allocations).toHaveLength(1);
  });
});
