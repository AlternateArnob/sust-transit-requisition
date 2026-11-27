import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { resetRateLimitStores } from "../../src/middleware/rateLimit.js";
import { audit } from "../../src/services/audit.js";
import { db, truncateAll } from "../helpers/db.js";
import {
  createAllocation,
  createDriver,
  createScenario,
  createUser,
  createVehicle,
} from "../helpers/factories.js";
import { bearer } from "../helpers/session.js";

const BASE = env.API_BASE_PATH;
const app = createApp();

type Row = Record<string, unknown>;

const get = (user: Row, query = "") =>
  request(app).get(`${BASE}/drivers${query}`).set(bearer(user));
const post = (user: Row, body: object = {}, path = "") =>
  request(app).post(`${BASE}/drivers${path}`).set(bearer(user)).send(body);
const patch = (user: Row, id: unknown, body: object) =>
  request(app).patch(`${BASE}/drivers/${id}`).set(bearer(user)).send(body);
const del = (user: Row, id: unknown) =>
  request(app).delete(`${BASE}/drivers/${id}`).set(bearer(user));
const action = (user: Row, id: unknown, name: "activate" | "deactivate") =>
  post(user, {}, `/${id}/${name}`);

const driverRow = (id: unknown) => db("drivers").where({ id }).first();
const vehicleRow = (id: unknown) => db("vehicles").where({ id }).first();
const auditRows = (action?: string) =>
  action ? db("audit_logs").where({ action }).orderBy("id") : db("audit_logs").orderBy("id");

let n = 0;
const staff = (role: string) =>
  createUser({ email: `${role.toLowerCase()}${++n}@sust.edu`, role, is_verified: 1 });

beforeEach(async () => {
  await truncateAll();
  resetRateLimitStores();
});
afterAll(() => db.destroy());

// =============================================================================================

describe("access control", () => {
  it("requires authentication on every route", async () => {
    const id = randomUUID();
    for (const res of [
      await request(app).get(`${BASE}/drivers`),
      await request(app).post(`${BASE}/drivers`).send({}),
      await request(app).patch(`${BASE}/drivers/${id}`).send({}),
      await request(app).post(`${BASE}/drivers/${id}/activate`),
      await request(app).post(`${BASE}/drivers/${id}/deactivate`),
      await request(app).delete(`${BASE}/drivers/${id}`),
    ]) {
      expect(res.status).toBe(401);
    }
  });

  it.each(["Applicant", "DepartmentHead"])("gives a %s 403 on every route", async (role) => {
    const user = await staff(role);
    const driver = await createDriver();
    for (const res of [
      await get(user),
      await post(user, { name: "X", designation: "Driver" }),
      await patch(user, driver.id, { name: "Hacked" }),
      await action(user, driver.id, "activate"),
      await action(user, driver.id, "deactivate"),
      await del(user, driver.id),
    ]) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    }
    expect((await driverRow(driver.id)).name).not.toBe("Hacked");
    expect(await driverRow(driver.id)).toBeDefined();
  });

  it.each(["TransportInCharge", "TransportAdministrator", "SuperAdmin"])(
    "lets a %s use every route",
    async (role) => {
      const user = await staff(role);

      const created = await post(user, { name: "Role Check", designation: "Driver" });
      expect(created.status).toBe(201);
      const id = created.body.id;

      expect((await get(user)).status).toBe(200);
      expect((await patch(user, id, { name: "Role Check 2" })).status).toBe(200);
      expect((await action(user, id, "deactivate")).status).toBe(200);
      expect((await action(user, id, "activate")).status).toBe(200);
      expect((await del(user, id)).status).toBe(204);
    },
  );

  it("refuses an onboarding token", async () => {
    const user = await staff("TransportInCharge");
    const res = await request(app).get(`${BASE}/drivers`).set(bearer(user, "onboarding"));
    expect(res.status).toBe(403);
  });

  it("refuses a deactivated staff account on the next request", async () => {
    const user = await staff("TransportInCharge");
    await db("users").where({ id: user.id }).update({ is_active: 0 });
    const res = await get(user);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_DEACTIVATED");
  });
});

// =============================================================================================

describe("POST /drivers", () => {
  it("creates an Active driver and returns the DTO", async () => {
    const user = await staff("TransportInCharge");
    const res = await post(user, {
      name: "  Abdul Karim  ",
      designation: "Senior Driver",
      phone: " 01711-111111 ",
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      name: "Abdul Karim",
      designation: "Senior Driver",
      phone: "01711-111111",
      status: "Active",
    });
    expect(res.body).not.toHaveProperty("permanentVehicleId");
    expect(await driverRow(res.body.id)).toMatchObject({ name: "Abdul Karim", status: "Active" });
  });

  it("accepts a driver without a phone, and treats a blank phone as none", async () => {
    const user = await staff("TransportInCharge");
    for (const body of [
      { name: "No Phone", designation: "Driver" },
      { name: "Blank Phone", designation: "Driver", phone: "" },
      { name: "Null Phone", designation: "Driver", phone: null },
    ]) {
      const res = await post(user, body);
      expect(res.status).toBe(201);
      expect(res.body).not.toHaveProperty("phone");
      expect((await driverRow(res.body.id)).phone).toBeNull();
    }
  });

  it.each([
    ["a missing name", { designation: "Driver" }, "name"],
    ["a blank name", { name: "   ", designation: "Driver" }, "name"],
    ["a too-long name", { name: "x".repeat(151), designation: "Driver" }, "name"],
    ["a missing designation", { name: "A" }, "designation"],
    ["an unknown designation", { name: "A", designation: "Pilot" }, "designation"],
    ["a malformed phone", { name: "A", designation: "Driver", phone: "call me" }, "phone"],
    ["a too-short phone", { name: "A", designation: "Driver", phone: "123" }, "phone"],
  ])("rejects %s with 422", async (_label, body, path) => {
    const user = await staff("TransportInCharge");
    const res = await post(user, body);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path })]),
    );
    expect(await db("drivers")).toHaveLength(0);
  });

  it("rejects fields that are not part of a new driver (status, link, id)", async () => {
    const user = await staff("TransportInCharge");
    for (const extra of [
      { status: "Inactive" },
      { permanentVehicleId: randomUUID() },
      { id: randomUUID() },
    ]) {
      const res = await post(user, { name: "A", designation: "Driver", ...extra });
      expect(res.status).toBe(422);
      expect(res.body.error.details[0].message).toBe("Unrecognized key");
    }
    expect(await db("drivers")).toHaveLength(0);
  });

  it("accepts every designation", async () => {
    const user = await staff("TransportInCharge");
    for (const designation of [
      "Supervisor Driver",
      "Senior Driver",
      "Driver",
      "Driver (Grade-1)",
      "Driver (Outsourced)",
    ]) {
      expect((await post(user, { name: designation, designation })).status).toBe(201);
    }
  });

  it("writes a driver.created audit row with the actor, role and new values", async () => {
    const user = await staff("TransportAdministrator");
    const res = await post(user, { name: "Audited", designation: "Driver" });

    const [row] = await auditRows("driver.created");
    expect(row).toMatchObject({
      actor_user_id: user.id,
      actor_role: "TransportAdministrator",
      entity_type: "driver",
      entity_id: res.body.id,
      before_json: null,
    });
    expect(row.after_json).toMatchObject({ name: "Audited", status: "Active" });
  });
});

// =============================================================================================

describe("GET /drivers", () => {
  it("returns { data } sorted by name, with the computed permanentVehicleId", async () => {
    const user = await staff("TransportInCharge");
    const zed = await createDriver({ name: "Zed" });
    const amin = await createDriver({ name: "Amin", phone: "01800-000000" });
    const vehicle = await createVehicle({ permanent_driver_id: zed.id });

    const res = await get(user);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: [
        {
          id: amin.id,
          name: "Amin",
          designation: "Driver",
          phone: "01800-000000",
          status: "Active",
        },
        {
          id: zed.id,
          name: "Zed",
          designation: "Driver",
          status: "Active",
          permanentVehicleId: vehicle.id,
        },
      ],
    });
    expect(res.body).not.toHaveProperty("meta");
  });

  it("returns an empty list when there are no drivers", async () => {
    const user = await staff("TransportInCharge");
    expect((await get(user)).body).toEqual({ data: [] });
  });

  it("filters by status", async () => {
    const user = await staff("TransportInCharge");
    await createDriver({ name: "On" });
    await createDriver({ name: "Off", status: "Inactive" });

    expect((await get(user, "?status=Active")).body.data.map((d: Row) => d.name)).toEqual(["On"]);
    expect((await get(user, "?status=Inactive")).body.data.map((d: Row) => d.name)).toEqual([
      "Off",
    ]);
    expect((await get(user)).body.data).toHaveLength(2);
    expect((await get(user, "?status=Retired")).status).toBe(422);
  });

  it("searches name, designation and phone, ignoring case", async () => {
    const user = await staff("TransportInCharge");
    await createDriver({
      name: "Rahim Uddin",
      designation: "Senior Driver",
      phone: "01711-123456",
    });
    await createDriver({ name: "Karim Mia", designation: "Driver (Outsourced)", phone: null });

    const names = async (q: string) =>
      (await get(user, `?q=${encodeURIComponent(q)}`)).body.data.map((d: Row) => d.name);

    expect(await names("rahim")).toEqual(["Rahim Uddin"]);
    expect(await names("OUTSOURCED")).toEqual(["Karim Mia"]);
    expect(await names("123456")).toEqual(["Rahim Uddin"]);
    expect(await names("mia")).toEqual(["Karim Mia"]);
    expect(await names("nobody")).toEqual([]);
  });

  it("treats % and _ in the search text literally", async () => {
    const user = await staff("TransportInCharge");
    await createDriver({ name: "100% Driver" });
    await createDriver({ name: "Plain Driver" });

    const percent = await get(user, `?q=${encodeURIComponent("%")}`);
    expect(percent.body.data.map((d: Row) => d.name)).toEqual(["100% Driver"]);
    const underscore = await get(user, `?q=${encodeURIComponent("_")}`);
    expect(underscore.body.data).toEqual([]);
  });

  it("rejects unknown query parameters", async () => {
    const user = await staff("TransportInCharge");
    expect((await get(user, "?page=2")).status).toBe(422);
  });
});

// =============================================================================================

describe("PATCH /drivers/:id", () => {
  it("updates only the fields sent", async () => {
    const user = await staff("TransportInCharge");
    const driver = await createDriver({
      name: "Old",
      designation: "Driver",
      phone: "01711-000000",
    });

    const res = await patch(user, driver.id, { name: "  New Name ", designation: "Senior Driver" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: driver.id,
      name: "New Name",
      designation: "Senior Driver",
      phone: "01711-000000",
      status: "Active",
    });
    expect(await driverRow(driver.id)).toMatchObject({ name: "New Name", phone: "01711-000000" });
  });

  it("clears the phone with null or an empty string", async () => {
    const user = await staff("TransportInCharge");
    for (const phone of [null, ""]) {
      const driver = await createDriver({ phone: "01711-000000" });
      const res = await patch(user, driver.id, { phone });
      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty("phone");
      expect((await driverRow(driver.id)).phone).toBeNull();
    }
  });

  it("includes the vehicle link in the response", async () => {
    const user = await staff("TransportInCharge");
    const driver = await createDriver();
    const vehicle = await createVehicle({ permanent_driver_id: driver.id });
    const res = await patch(user, driver.id, { name: "Linked" });
    expect(res.body.permanentVehicleId).toBe(vehicle.id);
  });

  it("writes a driver.updated audit row with before and after", async () => {
    const user = await staff("SuperAdmin");
    const driver = await createDriver({ name: "Before", designation: "Driver" });
    await patch(user, driver.id, { name: "After" });

    const [row] = await auditRows("driver.updated");
    expect(row).toMatchObject({ actor_user_id: user.id, entity_id: driver.id });
    expect(row.before_json).toMatchObject({ name: "Before" });
    expect(row.after_json).toMatchObject({ name: "After" });
  });

  it("writes nothing when nothing changes", async () => {
    const user = await staff("TransportInCharge");
    const driver = await createDriver({ name: "Same", designation: "Driver" });

    expect((await patch(user, driver.id, {})).status).toBe(200);
    expect((await patch(user, driver.id, { name: "Same", designation: "Driver" })).status).toBe(
      200,
    );
    expect(await auditRows()).toHaveLength(0);
  });

  it("cannot change status, the vehicle link or the id", async () => {
    const user = await staff("TransportInCharge");
    const driver = await createDriver();
    for (const body of [
      { status: "Inactive" },
      { permanentVehicleId: randomUUID() },
      { id: randomUUID() },
    ]) {
      const res = await patch(user, driver.id, body);
      expect(res.status).toBe(422);
    }
    expect((await driverRow(driver.id)).status).toBe("Active");
  });

  it("validates values", async () => {
    const user = await staff("TransportInCharge");
    const driver = await createDriver();
    expect((await patch(user, driver.id, { name: "" })).status).toBe(422);
    expect((await patch(user, driver.id, { designation: "Pilot" })).status).toBe(422);
    expect((await patch(user, driver.id, { phone: "abc" })).status).toBe(422);
  });

  it("answers 404 for an unknown driver and 422 for a malformed id", async () => {
    const user = await staff("TransportInCharge");
    const missing = await patch(user, randomUUID(), { name: "X" });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("NOT_FOUND");
    expect((await patch(user, "not-a-uuid", { name: "X" })).status).toBe(422);
  });
});

// =============================================================================================

describe("POST /drivers/:id/deactivate and /activate", () => {
  it("deactivates a driver and frees their vehicle in one go", async () => {
    const user = await staff("TransportInCharge");
    const driver = await createDriver();
    const vehicle = await createVehicle({ permanent_driver_id: driver.id });

    const res = await action(user, driver.id, "deactivate");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: driver.id, status: "Inactive" });
    expect(res.body).not.toHaveProperty("permanentVehicleId");

    expect((await driverRow(driver.id)).status).toBe("Inactive");
    expect((await vehicleRow(vehicle.id)).permanent_driver_id).toBeNull();
  });

  it("leaves other drivers and vehicles alone", async () => {
    const user = await staff("TransportInCharge");
    const leaving = await createDriver({ name: "Leaving" });
    const staying = await createDriver({ name: "Staying" });
    await createVehicle({ permanent_driver_id: leaving.id });
    const other = await createVehicle({ permanent_driver_id: staying.id });

    await action(user, leaving.id, "deactivate");
    expect((await vehicleRow(other.id)).permanent_driver_id).toBe(staying.id);
    expect((await driverRow(staying.id)).status).toBe("Active");
  });

  it("deactivates a driver who has no vehicle", async () => {
    const user = await staff("TransportInCharge");
    const driver = await createDriver();
    const res = await action(user, driver.id, "deactivate");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Inactive");
  });

  it("rolls everything back when the audit row cannot be written", async () => {
    const user = await staff("TransportInCharge");
    const driver = await createDriver();
    const vehicle = await createVehicle({ permanent_driver_id: driver.id });

    const spy = vi.spyOn(audit, "log").mockRejectedValueOnce(new Error("audit is down"));
    const res = await action(user, driver.id, "deactivate");
    spy.mockRestore();

    expect(res.status).toBe(500);
    expect((await driverRow(driver.id)).status).toBe("Active");
    expect((await vehicleRow(vehicle.id)).permanent_driver_id).toBe(driver.id);
  });

  it("is idempotent: deactivating again changes and logs nothing", async () => {
    const user = await staff("TransportInCharge");
    const driver = await createDriver();
    await action(user, driver.id, "deactivate");
    const again = await action(user, driver.id, "deactivate");

    expect(again.status).toBe(200);
    expect(again.body.status).toBe("Inactive");
    expect(await auditRows("driver.deactivated")).toHaveLength(1);
  });

  it("activates an inactive driver; the old vehicle link is not restored", async () => {
    const user = await staff("TransportInCharge");
    const driver = await createDriver();
    const vehicle = await createVehicle({ permanent_driver_id: driver.id });
    await action(user, driver.id, "deactivate");

    const res = await action(user, driver.id, "activate");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "Active" });
    expect(res.body).not.toHaveProperty("permanentVehicleId");
    expect((await vehicleRow(vehicle.id)).permanent_driver_id).toBeNull();

    expect((await action(user, driver.id, "activate")).status).toBe(200);
    expect(await auditRows("driver.activated")).toHaveLength(1);
  });

  it("writes audit rows with before and after status", async () => {
    const user = await staff("TransportAdministrator");
    const driver = await createDriver();
    const vehicle = await createVehicle({ permanent_driver_id: driver.id });
    await action(user, driver.id, "deactivate");

    const [row] = await auditRows("driver.deactivated");
    expect(row).toMatchObject({ actor_user_id: user.id, actor_role: "TransportAdministrator" });
    expect(row.before_json).toMatchObject({ status: "Active", permanentVehicleId: vehicle.id });
    expect(row.after_json).toMatchObject({ status: "Inactive", permanentVehicleId: null });
  });

  it("answers 404 for an unknown driver", async () => {
    const user = await staff("TransportInCharge");
    expect((await action(user, randomUUID(), "deactivate")).status).toBe(404);
    expect((await action(user, randomUUID(), "activate")).status).toBe(404);
  });

  it("handles parallel deactivations: all succeed, one audit row", async () => {
    const user = await staff("TransportInCharge");
    const driver = await createDriver();
    await createVehicle({ permanent_driver_id: driver.id });

    const results = await Promise.all([1, 2, 3].map(() => action(user, driver.id, "deactivate")));
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(await auditRows("driver.deactivated")).toHaveLength(1);
    expect(await db("vehicles").whereNotNull("permanent_driver_id")).toHaveLength(0);
  });
});

// =============================================================================================

describe("DELETE /drivers/:id", () => {
  it("deletes an unreferenced driver and logs it", async () => {
    const user = await staff("TransportInCharge");
    const driver = await createDriver({ name: "Gone" });

    const res = await del(user, driver.id);
    expect(res.status).toBe(204);
    expect(res.text).toBe("");
    expect(await driverRow(driver.id)).toBeUndefined();

    const [row] = await auditRows("driver.deleted");
    expect(row).toMatchObject({ actor_user_id: user.id, entity_id: driver.id, after_json: null });
    expect(row.before_json).toMatchObject({ name: "Gone" });
  });

  it("answers 404 for an unknown driver, and a second delete is 404", async () => {
    const user = await staff("TransportInCharge");
    const driver = await createDriver();
    expect((await del(user, randomUUID())).status).toBe(404);
    expect((await del(user, driver.id)).status).toBe(204);
    expect((await del(user, driver.id)).status).toBe(404);
  });

  it("is refused while the driver is a vehicle's permanent driver", async () => {
    const user = await staff("TransportInCharge");
    const driver = await createDriver();
    const vehicle = await createVehicle({ permanent_driver_id: driver.id });

    const res = await del(user, driver.id);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: "DRIVER_IN_USE",
      details: { vehicles: 1, allocations: 0, dutySlips: 0, allocationHistory: 0 },
    });
    expect(await driverRow(driver.id)).toBeDefined();
    expect((await vehicleRow(vehicle.id)).permanent_driver_id).toBe(driver.id);
    expect(await auditRows("driver.deleted")).toHaveLength(0);
  });

  it("is refused when an allocation uses the driver", async () => {
    const user = await staff("TransportInCharge");
    const scenario = await createScenario();
    const driver = await createDriver();
    await createAllocation(
      {
        requisitionId: scenario.requisition.id as string,
        tripId: scenario.trip.id as string,
        vehicleId: scenario.vehicle.id as string,
        allocatedBy: scenario.admin.id as string,
      },
      { driver_id: driver.id },
    );

    const res = await del(user, driver.id);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DRIVER_IN_USE");
    expect(res.body.error.details.allocations).toBe(1);
    expect(await driverRow(driver.id)).toBeDefined();
    // The allocation must still point at the driver (the FK would have blanked it).
    expect((await db("allocations").first()).driver_id).toBe(driver.id);
  });

  it("is refused when a duty slip names the driver", async () => {
    const user = await staff("TransportInCharge");
    const scenario = await createScenario();
    const driver = await createDriver();
    await db("duty_slips").insert({
      id: randomUUID(),
      requisition_id: scenario.requisition.id,
      driver_id: driver.id,
      driver_name: driver.name,
      driver_designation: "Driver",
      generated_by: scenario.admin.id,
      generated_at: new Date(),
    });

    const res = await del(user, driver.id);
    expect(res.status).toBe(409);
    expect(res.body.error.details.dutySlips).toBe(1);
    expect(await driverRow(driver.id)).toBeDefined();
  });

  it("is refused when the allocation history mentions the driver", async () => {
    const user = await staff("TransportInCharge");
    const scenario = await createScenario();
    const driver = await createDriver();
    await db("allocation_history").insert({
      trip_id: scenario.trip.id,
      requisition_id: scenario.requisition.id,
      event: "assigned",
      driver_id: driver.id,
    });

    const res = await del(user, driver.id);
    expect(res.status).toBe(409);
    expect(res.body.error.details.allocationHistory).toBe(1);
  });

  it("works once the driver has been deactivated and no longer has a vehicle", async () => {
    const user = await staff("TransportInCharge");
    const driver = await createDriver();
    await createVehicle({ permanent_driver_id: driver.id });

    expect((await del(user, driver.id)).status).toBe(409);
    await action(user, driver.id, "deactivate");
    expect((await del(user, driver.id)).status).toBe(204);
  });

  it("two parallel deletes: one succeeds, the other is 404", async () => {
    const user = await staff("TransportInCharge");
    const driver = await createDriver();
    const results = await Promise.all([del(user, driver.id), del(user, driver.id)]);
    expect(results.map((r) => r.status).sort()).toEqual([204, 404]);
    expect(await auditRows("driver.deleted")).toHaveLength(1);
  });
});
