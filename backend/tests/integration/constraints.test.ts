import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, truncateAll } from "../helpers/db.js";
import {
  createAllocation,
  createDriver,
  createRequisition,
  createScenario,
  createTrip,
  createUser,
  createVehicle,
} from "../helpers/factories.js";

beforeEach(truncateAll);
afterAll(async () => {
  await db.destroy();
});

const DUPLICATE = { code: "ER_DUP_ENTRY" };
const CHECK_FAILED = { code: "ER_CHECK_CONSTRAINT_VIOLATED" };
const REFERENCED = { code: "ER_ROW_IS_REFERENCED_2" };
const NO_PARENT = { code: "ER_NO_REFERENCED_ROW_2" };

describe("unique keys", () => {
  it("rejects a duplicate users.email, ignoring case", async () => {
    await createUser({ email: "student@student.sust.edu" });
    await expect(createUser({ email: "student@student.sust.edu" })).rejects.toMatchObject(
      DUPLICATE,
    );
    await expect(createUser({ email: "STUDENT@Student.SUST.edu" })).rejects.toMatchObject(
      DUPLICATE,
    );
  });

  it("rejects a duplicate vehicles.registration_number, ignoring case", async () => {
    await createVehicle({ registration_number: "Sylhet-Metro-Ga-11-1234" });
    await expect(
      createVehicle({ registration_number: "Sylhet-Metro-Ga-11-1234" }),
    ).rejects.toMatchObject(DUPLICATE);
    await expect(
      createVehicle({ registration_number: "SYLHET-METRO-GA-11-1234" }),
    ).rejects.toMatchObject(DUPLICATE);
  });

  it("lets a driver be the permanent driver of at most one vehicle", async () => {
    const driver = await createDriver();
    await createVehicle({ permanent_driver_id: driver.id });
    await expect(createVehicle({ permanent_driver_id: driver.id })).rejects.toMatchObject(
      DUPLICATE,
    );
  });

  it("allows many vehicles without a permanent driver", async () => {
    await createVehicle({ permanent_driver_id: null });
    await expect(createVehicle({ permanent_driver_id: null })).resolves.toBeDefined();
  });

  it("rejects two allocations for one trip", async () => {
    const { requisition, trip, vehicle, admin } = await createScenario();
    const other = await createVehicle();
    const args = {
      requisitionId: requisition.id as string,
      tripId: trip.id as string,
      allocatedBy: admin.id as string,
    };
    await createAllocation({ ...args, vehicleId: vehicle.id as string });
    await expect(
      createAllocation({ ...args, vehicleId: other.id as string }),
    ).rejects.toMatchObject(DUPLICATE);
  });

  it("rejects a second mileage entry for the same trip", async () => {
    const { requisition, trip, admin } = await createScenario();
    const entry = () => ({
      id: randomUUID(),
      requisition_id: requisition.id,
      trip_id: trip.id,
      distance_km: 12.5,
      recorded_by: admin.id,
      recorded_at: new Date(),
    });
    await db("mileage_entries").insert(entry());
    await expect(db("mileage_entries").insert(entry())).rejects.toMatchObject(DUPLICATE);
  });

  it("allows one OTP challenge per email", async () => {
    const row = () => ({
      id: randomUUID(),
      email: "a@b.edu",
      code_hash: "hash",
      expires_at: new Date(Date.now() + 60_000),
      last_sent_at: new Date(),
    });
    await db("otp_challenges").insert(row());
    await expect(db("otp_challenges").insert(row())).rejects.toMatchObject(DUPLICATE);
  });

  it("rejects a duplicate refresh-token hash", async () => {
    const user = await createUser();
    const row = () => ({
      id: randomUUID(),
      user_id: user.id,
      family_id: randomUUID(),
      token_hash: "a".repeat(64),
      expires_at: new Date(Date.now() + 60_000),
    });
    await db("refresh_tokens").insert(row());
    await expect(db("refresh_tokens").insert(row())).rejects.toMatchObject(DUPLICATE);
  });

  it("de-duplicates notifications by dedupe_key but allows many without one", async () => {
    const user = await createUser();
    const row = (dedupeKey: string | null) => ({
      id: randomUUID(),
      recipient_user_id: user.id,
      type: "New Requisition",
      message: "hello",
      link_type: "requisition",
      link_id: "TRS-2026-001",
      dedupe_key: dedupeKey,
    });
    await db("notifications").insert(row("req:TRS-2026-001:new"));
    await expect(db("notifications").insert(row("req:TRS-2026-001:new"))).rejects.toMatchObject(
      DUPLICATE,
    );
    await db("notifications").insert(row(null));
    await expect(db("notifications").insert(row(null))).resolves.toBeDefined();
  });

  it("allows one student-transport entry per vehicle and one slot per weekday", async () => {
    const vehicle = await createVehicle();
    const entryId = randomUUID();
    await db("student_transport_vehicles").insert({ id: entryId, vehicle_id: vehicle.id });
    await expect(
      db("student_transport_vehicles").insert({ id: randomUUID(), vehicle_id: vehicle.id }),
    ).rejects.toMatchObject(DUPLICATE);
    await db("student_transport_slots").insert({
      entry_id: entryId,
      weekday: "Mon",
      free_after: "14:30",
    });
    await expect(
      db("student_transport_slots").insert({
        entry_id: entryId,
        weekday: "Mon",
        free_after: "16:00",
      }),
    ).rejects.toMatchObject(DUPLICATE);
    await expect(
      db("student_transport_slots").insert({
        entry_id: entryId,
        weekday: "Tue",
        free_after: "16:00",
      }),
    ).resolves.toBeDefined();
  });

  it("rejects a duplicate directory unit name", async () => {
    await db("directory_units").insert({
      kind: "Department",
      name: "Computer Science and Engineering",
    });
    await expect(
      db("directory_units").insert({ kind: "Office", name: "Computer Science and Engineering" }),
    ).rejects.toMatchObject(DUPLICATE);
  });
});

describe("CHECK constraints", () => {
  async function insertOffDay(row: Record<string, unknown>) {
    const vehicle = await createVehicle();
    return db("vehicle_off_days").insert({ id: randomUUID(), vehicle_id: vehicle.id, ...row });
  }

  it("accepts a well-formed one-time and recurring off-day", async () => {
    await expect(insertOffDay({ type: "One-time", off_date: "2026-10-22" })).resolves.toBeDefined();
    await expect(insertOffDay({ type: "Recurring", weekday: "Fri" })).resolves.toBeDefined();
  });

  it.each([
    ["one-time without a date", { type: "One-time" }],
    ["one-time with a weekday", { type: "One-time", off_date: "2026-10-22", weekday: "Fri" }],
    ["one-time with only a weekday", { type: "One-time", weekday: "Fri" }],
    ["recurring without a weekday", { type: "Recurring" }],
    ["recurring with a date", { type: "Recurring", weekday: "Fri", off_date: "2026-10-22" }],
    ["recurring with only a date", { type: "Recurring", off_date: "2026-10-22" }],
  ])("rejects an off-day that is %s (ck_offday_shape)", async (_name, row) => {
    const error = await insertOffDay(row).catch((e: unknown) => e);
    expect(error).toMatchObject(CHECK_FAILED);
    expect((error as Error).message).toContain("ck_offday_shape");
  });

  it("rejects a trip that ends before it starts (ck_trip_times)", async () => {
    const requester = await createUser();
    const requisition = await createRequisition(requester.id as string);
    const error = await createTrip(requisition.id as string, {
      start_time: "11:00",
      end_time: "09:59",
    }).catch((e: unknown) => e);
    expect(error).toMatchObject(CHECK_FAILED);
    expect((error as Error).message).toContain("ck_trip_times");
  });

  it("accepts a trip whose end equals its start", async () => {
    const requester = await createUser();
    const requisition = await createRequisition(requester.id as string);
    await expect(
      createTrip(requisition.id as string, { start_time: "10:00", end_time: "10:00" }),
    ).resolves.toBeDefined();
  });

  it.each([0, -5, -0.01])("rejects mileage distance_km = %s (ck_mil_pos)", async (distance) => {
    const { requisition, trip, admin } = await createScenario();
    const error = await db("mileage_entries")
      .insert({
        id: randomUUID(),
        requisition_id: requisition.id,
        trip_id: trip.id,
        distance_km: distance,
        recorded_by: admin.id,
        recorded_at: new Date(),
      })
      .catch((e: unknown) => e);
    expect(error).toMatchObject(CHECK_FAILED);
    expect((error as Error).message).toContain("ck_mil_pos");
  });

  it("accepts the smallest positive distance", async () => {
    const { requisition, trip, admin } = await createScenario();
    await expect(
      db("mileage_entries").insert({
        id: randomUUID(),
        requisition_id: requisition.id,
        trip_id: trip.id,
        distance_km: 0.01,
        recorded_by: admin.id,
        recorded_at: new Date(),
      }),
    ).resolves.toBeDefined();
  });
});

describe("foreign keys", () => {
  it("rejects a requisition whose requester does not exist", async () => {
    await expect(createRequisition(randomUUID())).rejects.toMatchObject(NO_PARENT);
  });

  it("rejects a trip for a requisition that does not exist", async () => {
    await expect(createTrip("TRS-2026-999")).rejects.toMatchObject(NO_PARENT);
  });

  it("does not let a user with requisitions be deleted", async () => {
    const { requester } = await createScenario();
    await expect(db("users").where({ id: requester.id }).delete()).rejects.toMatchObject(
      REFERENCED,
    );
  });

  it("does not let a vehicle with an allocation be deleted (ON DELETE RESTRICT)", async () => {
    const { requisition, trip, vehicle, admin } = await createScenario();
    await createAllocation({
      requisitionId: requisition.id as string,
      tripId: trip.id as string,
      vehicleId: vehicle.id as string,
      allocatedBy: admin.id as string,
    });
    await expect(db("vehicles").where({ id: vehicle.id }).delete()).rejects.toMatchObject(
      REFERENCED,
    );
  });

  it("deleting a requisition removes its trips, allocations and mileage (ON DELETE CASCADE)", async () => {
    const { requisition, trip, vehicle, admin } = await createScenario();
    await createAllocation({
      requisitionId: requisition.id as string,
      tripId: trip.id as string,
      vehicleId: vehicle.id as string,
      allocatedBy: admin.id as string,
    });
    await db("mileage_entries").insert({
      id: randomUUID(),
      requisition_id: requisition.id,
      trip_id: trip.id,
      distance_km: 10,
      recorded_by: admin.id,
      recorded_at: new Date(),
    });
    await db("requisitions").where({ id: requisition.id }).delete();
    expect(await db("trips").count({ n: "*" }).first()).toEqual({ n: 0 });
    expect(await db("allocations").count({ n: "*" }).first()).toEqual({ n: 0 });
    expect(await db("mileage_entries").count({ n: "*" }).first()).toEqual({ n: 0 });
    expect(await db("vehicles").count({ n: "*" }).first()).toEqual({ n: 1 });
  });

  it("deleting a driver clears the vehicle link instead of deleting the vehicle (SET NULL)", async () => {
    const driver = await createDriver();
    const vehicle = await createVehicle({ permanent_driver_id: driver.id });
    await db("drivers").where({ id: driver.id }).delete();
    expect(await db("vehicles").where({ id: vehicle.id }).first("permanent_driver_id")).toEqual({
      permanent_driver_id: null,
    });
  });

  it("deleting a vehicle removes its off-days and student-transport schedule (CASCADE)", async () => {
    const vehicle = await createVehicle();
    const entryId = randomUUID();
    await db("vehicle_off_days").insert({
      id: randomUUID(),
      vehicle_id: vehicle.id,
      type: "Recurring",
      weekday: "Fri",
    });
    await db("student_transport_vehicles").insert({ id: entryId, vehicle_id: vehicle.id });
    await db("student_transport_slots").insert({
      entry_id: entryId,
      weekday: "Sun",
      free_after: "13:00",
    });
    await db("vehicles").where({ id: vehicle.id }).delete();
    expect(await db("vehicle_off_days").count({ n: "*" }).first()).toEqual({ n: 0 });
    expect(await db("student_transport_vehicles").count({ n: "*" }).first()).toEqual({ n: 0 });
    expect(await db("student_transport_slots").count({ n: "*" }).first()).toEqual({ n: 0 });
  });

  it("deleting a user removes their refresh tokens and notifications (CASCADE)", async () => {
    const user = await createUser();
    await db("refresh_tokens").insert({
      id: randomUUID(),
      user_id: user.id,
      family_id: randomUUID(),
      token_hash: "b".repeat(64),
      expires_at: new Date(Date.now() + 60_000),
    });
    await db("notifications").insert({
      id: randomUUID(),
      recipient_user_id: user.id,
      type: "New Requisition",
      message: "m",
      link_type: "user",
      link_id: String(user.id),
    });
    await db("users").where({ id: user.id }).delete();
    expect(await db("refresh_tokens").count({ n: "*" }).first()).toEqual({ n: 0 });
    expect(await db("notifications").count({ n: "*" }).first()).toEqual({ n: 0 });
  });

  it("keeps allocation_history rows after the trip and vehicle are gone (no FKs on purpose)", async () => {
    const { requisition, trip, vehicle, admin } = await createScenario();
    await db("allocation_history").insert({
      trip_id: trip.id,
      requisition_id: requisition.id,
      event: "assigned",
      vehicle_id: vehicle.id,
      actor_user_id: admin.id,
    });
    await db("requisitions").where({ id: requisition.id }).delete();
    await db("vehicles").where({ id: vehicle.id }).delete();
    expect(await db("allocation_history").count({ n: "*" }).first()).toEqual({ n: 1 });
  });
});

describe("ENUM columns", () => {
  it("reject values outside the allowed set", async () => {
    await expect(createUser({ role: "Hacker" })).rejects.toBeDefined();
    await expect(createVehicle({ category: "Spaceship" })).rejects.toBeDefined();
    await expect(createDriver({ designation: "Pilot" })).rejects.toBeDefined();
    const requester = await createUser();
    await expect(
      createRequisition(requester.id as string, { status: "Weird" }),
    ).rejects.toBeDefined();
    const requisition = await createRequisition(requester.id as string);
    await expect(createTrip(requisition.id as string, { status: "Maybe" })).rejects.toBeDefined();
    await expect(
      createTrip(requisition.id as string, { vehicle_category: "Tuk-tuk" }),
    ).rejects.toBeDefined();
  });

  it("accept 'Any' as a requested trip category but not as a vehicle category", async () => {
    const requester = await createUser();
    const requisition = await createRequisition(requester.id as string);
    const trip = await createTrip(requisition.id as string);
    expect(trip.vehicle_category).toBeUndefined();
    expect(await db("trips").where({ id: trip.id }).first("vehicle_category")).toEqual({
      vehicle_category: "Any",
    });
    await expect(createVehicle({ category: "Any" })).rejects.toBeDefined();
  });
});

describe("value round-tripping", () => {
  it("returns DATE and TIME as plain strings and JSON as parsed values", async () => {
    const requester = await createUser();
    const requisition = await createRequisition(requester.id as string, {
      start_date: "2026-10-22",
    });
    const trip = await createTrip(requisition.id as string, { trip_date: "2026-10-22" });
    const row = await db("trips").where({ id: trip.id }).first();
    expect(row.trip_date).toBe("2026-10-22");
    expect(row.start_time).toBe("09:00:00");
    expect(row.end_time).toBe("11:00:00");
    expect(row.stoppage_sequence).toEqual(["Campus", "Zindabazar", "Campus"]);
    expect(row.passenger_groups).toEqual([]);
    expect(await db("requisitions").where({ id: requisition.id }).first("start_date")).toEqual({
      start_date: "2026-10-22",
    });
  });

  it("applies the documented defaults", async () => {
    const user = await createUser();
    const row = await db("users").where({ id: user.id }).first();
    expect(row).toMatchObject({
      is_verified: 0,
      is_active: 1,
      failed_login_count: 0,
      locked_until: null,
    });
    const vehicle = await createVehicle();
    expect(await db("vehicles").where({ id: vehicle.id }).first()).toMatchObject({
      operational_status: "Active",
      available_for_requisition: 1,
      permanent_driver_id: null,
    });
    const driver = await createDriver();
    expect(await db("drivers").where({ id: driver.id }).first("status")).toEqual({
      status: "Active",
    });
  });

  it("refreshes updated_at when a row changes", async () => {
    const vehicle = await createVehicle();
    const before = await db("vehicles").where({ id: vehicle.id }).first("updated_at");
    await new Promise((resolve) => setTimeout(resolve, 20));
    await db("vehicles").where({ id: vehicle.id }).update({ fuel_type: "Diesel" });
    const after = await db("vehicles").where({ id: vehicle.id }).first("updated_at");
    expect(after.updated_at > before.updated_at).toBe(true);
  });
});

describe("requisition_counters", () => {
  it("increments atomically with the Part 1 §10.4 upsert", async () => {
    const take = async (year: number) => {
      await db.raw(
        `INSERT INTO requisition_counters (year, last_number) VALUES (?, 1)
         ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1)`,
        [year],
      );
      const [rows] = (await db.raw(
        "SELECT last_number AS n FROM requisition_counters WHERE year = ?",
        [year],
      )) as [{ n: number }[], unknown];
      return rows[0]?.n;
    };
    expect(await take(2026)).toBe(1);
    expect(await take(2026)).toBe(2);
    expect(await take(2027)).toBe(1);
  });
});
