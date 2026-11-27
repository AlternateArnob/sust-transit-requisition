import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { resetRateLimitStores } from "../../src/middleware/rateLimit.js";
import { allocationGuardService } from "../../src/modules/allocationGuards/allocationGuard.service.js";
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

const get = (user: Row, path = "") => request(app).get(`${BASE}/vehicles${path}`).set(bearer(user));
const post = (user: Row, body: object = {}) =>
  request(app).post(`${BASE}/vehicles`).set(bearer(user)).send(body);
const patch = (user: Row, id: unknown, body: object) =>
  request(app).patch(`${BASE}/vehicles/${id}`).set(bearer(user)).send(body);
const del = (user: Row, id: unknown) =>
  request(app).delete(`${BASE}/vehicles/${id}`).set(bearer(user));

const vehicleRow = (id: unknown) => db("vehicles").where({ id }).first();
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
    expect((await request(app).get(`${BASE}/vehicles`)).status).toBe(401);
    expect((await request(app).post(`${BASE}/vehicles`).send({})).status).toBe(401);
  });

  it.each(["Applicant", "DepartmentHead"])("gives a %s 403 everywhere", async (role) => {
    const user = await staff(role);
    const vehicle = await createVehicle();
    for (const res of [
      await get(user),
      await get(user, `/${vehicle.id}`),
      await post(user, { registrationNumber: "X-1", category: "Car" }),
      await patch(user, vehicle.id, { category: "Jeep" }),
      await del(user, vehicle.id),
    ]) {
      expect(res.status).toBe(403);
    }
  });

  it.each(["TransportInCharge", "TransportAdministrator", "SuperAdmin"])(
    "lets a %s list vehicles",
    async (role) => {
      expect((await get(await staff(role))).status).toBe(200);
    },
  );
});

describe("create", () => {
  it("trims and upper-cases the registration and applies defaults", async () => {
    const user = await staff("TransportInCharge");
    const res = await post(user, { registrationNumber: "  sylhet  cha 11-0593 ", category: "Car" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      registrationNumber: "SYLHET CHA 11-0593",
      category: "Car",
      operationalStatus: "Active",
      availableForRequisition: true,
    });
    expect(res.body).not.toHaveProperty("reservedFor");
    expect(res.body).not.toHaveProperty("permanentDriverId");
    expect(await auditRows("vehicle.created")).toHaveLength(1);
  });

  it("rejects a duplicate registration regardless of case", async () => {
    const user = await staff("TransportInCharge");
    await createVehicle({ registration_number: "DHAKA-1" });
    const res = await post(user, { registrationNumber: "dhaka-1", category: "Car" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DUPLICATE_REGISTRATION");
  });

  it("rejects an invalid category and unknown keys with 422", async () => {
    const user = await staff("TransportInCharge");
    expect((await post(user, { registrationNumber: "A-1", category: "Tractor" })).status).toBe(422);
    expect(
      (await post(user, { registrationNumber: "A-1", category: "Car", reservedFor: "x" })).status,
    ).toBe(422);
    expect((await post(user, { registrationNumber: "  ", category: "Car" })).status).toBe(422);
  });

  it("assigns an Active free driver", async () => {
    const user = await staff("TransportInCharge");
    const driver = await createDriver();
    const res = await post(user, {
      registrationNumber: "A-2",
      category: "Jeep",
      permanentDriverId: driver.id,
    });
    expect(res.status).toBe(201);
    expect(res.body.permanentDriverId).toBe(driver.id);
  });

  it("rejects an inactive or missing driver with 422", async () => {
    const user = await staff("TransportInCharge");
    const inactive = await createDriver({ status: "Inactive" });
    for (const id of [inactive.id, randomUUID()]) {
      const res = await post(user, {
        registrationNumber: `B-${id.slice(0, 4)}`,
        category: "Jeep",
        permanentDriverId: id,
      });
      expect(res.status).toBe(422);
    }
    expect(await db("vehicles").count({ c: "*" }).first()).toMatchObject({ c: 0 });
  });

  it("rejects a driver already assigned to another vehicle with 409", async () => {
    const user = await staff("TransportInCharge");
    const driver = await createDriver();
    await createVehicle({ permanent_driver_id: driver.id });
    const res = await post(user, {
      registrationNumber: "C-1",
      category: "Car",
      permanentDriverId: driver.id,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DRIVER_ALREADY_ASSIGNED");
  });

  it("lets only one of two parallel requests take the same driver", async () => {
    const user = await staff("TransportInCharge");
    const driver = await createDriver();
    const results = await Promise.all(
      ["P-1", "P-2"].map((registrationNumber) =>
        post(user, { registrationNumber, category: "Car", permanentDriverId: driver.id }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });
});

describe("list and get", () => {
  it("filters by q, category and status, sorted by registration", async () => {
    const user = await staff("TransportInCharge");
    await createVehicle({ registration_number: "B-2", category: "Jeep" });
    await createVehicle({
      registration_number: "A-1",
      category: "Car",
      operational_status: "Out-of-Service",
    });
    await createVehicle({ registration_number: "C_3", category: "Car" });

    const all = await get(user);
    expect(all.body.data.map((v: Row) => v.registrationNumber)).toEqual(["A-1", "B-2", "C_3"]);
    expect((await get(user, "?category=Car")).body.data).toHaveLength(2);
    expect((await get(user, "?status=Out-of-Service")).body.data).toHaveLength(1);
    expect((await get(user, "?q=c_3")).body.data).toHaveLength(1);
    expect((await get(user, "?q=%25")).body.data).toHaveLength(0);
    expect((await get(user, "?status=Broken")).status).toBe(422);
  });

  it("returns the driver summary on GET /vehicles/:id", async () => {
    const user = await staff("TransportInCharge");
    const driver = await createDriver({ name: "Rahim", phone: "+8801700000000" });
    const vehicle = await createVehicle({ permanent_driver_id: driver.id });
    const res = await get(user, `/${vehicle.id}`);
    expect(res.status).toBe(200);
    expect(res.body.permanentDriver).toMatchObject({ id: driver.id, name: "Rahim", status: "Active" });
    expect((await get(user, `/${randomUUID()}`)).status).toBe(404);
    expect((await get(user, "/not-a-uuid")).status).toBe(422);
  });
});

describe("update", () => {
  it("updates fields, writes an audit row, and is a no-op when nothing changes", async () => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle({ registration_number: "U-1" });
    const res = await patch(user, vehicle.id, { category: "Jeep", fuelType: "Diesel" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ category: "Jeep", fuelType: "Diesel" });
    expect(await auditRows("vehicle.updated")).toHaveLength(1);

    await patch(user, vehicle.id, { category: "Jeep" });
    expect(await auditRows("vehicle.updated")).toHaveLength(1);

    const cleared = await patch(user, vehicle.id, { fuelType: null });
    expect(cleared.body).not.toHaveProperty("fuelType");
  });

  it("rejects a registration used by another vehicle, but not its own", async () => {
    const user = await staff("TransportInCharge");
    await createVehicle({ registration_number: "TAKEN-1" });
    const mine = await createVehicle({ registration_number: "MINE-1" });
    const dup = await patch(user, mine.id, { registrationNumber: "taken-1" });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("DUPLICATE_REGISTRATION");
    const own = await patch(user, mine.id, { registrationNumber: "mine-1" });
    expect(own.status).toBe(200);
  });

  it("reassigning frees the old driver", async () => {
    const user = await staff("TransportInCharge");
    const first = await createDriver();
    const second = await createDriver();
    const vehicle = await createVehicle({ permanent_driver_id: first.id });
    const res = await patch(user, vehicle.id, { permanentDriverId: second.id });
    expect(res.status).toBe(200);
    expect((await vehicleRow(vehicle.id)).permanent_driver_id).toBe(second.id);
    // The first driver can now be taken by another vehicle.
    const other = await post(user, {
      registrationNumber: "FREE-1",
      category: "Car",
      permanentDriverId: first.id,
    });
    expect(other.status).toBe(201);
  });

  it("clears the driver with null", async () => {
    const user = await staff("TransportInCharge");
    const driver = await createDriver();
    const vehicle = await createVehicle({ permanent_driver_id: driver.id });
    const res = await patch(user, vehicle.id, { permanentDriverId: null });
    expect(res.status).toBe(200);
    expect((await vehicleRow(vehicle.id)).permanent_driver_id).toBeNull();
  });

  it("rejects a driver assigned elsewhere (409) and an inactive driver (422)", async () => {
    const user = await staff("TransportInCharge");
    const busy = await createDriver();
    await createVehicle({ permanent_driver_id: busy.id });
    const inactive = await createDriver({ status: "Inactive" });
    const vehicle = await createVehicle();
    expect((await patch(user, vehicle.id, { permanentDriverId: busy.id })).status).toBe(409);
    expect((await patch(user, vehicle.id, { permanentDriverId: inactive.id })).status).toBe(422);
    expect((await vehicleRow(vehicle.id)).permanent_driver_id).toBeNull();
  });

  it("returns 404 for an unknown vehicle", async () => {
    const user = await staff("TransportInCharge");
    expect((await patch(user, randomUUID(), { category: "Car" })).status).toBe(404);
  });

  it("calls the allocation guard only when the vehicle becomes unavailable", async () => {
    const user = await staff("TransportInCharge");
    const spy = vi.spyOn(allocationGuardService, "assertVehicleCanBecomeUnavailable");
    const vehicle = await createVehicle();

    await patch(user, vehicle.id, { category: "Jeep" });
    expect(spy).not.toHaveBeenCalled();

    await patch(user, vehicle.id, { availableForRequisition: false });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0]).toBe(vehicle.id);

    // Already unavailable: moving between unavailable states does not call it again.
    await patch(user, vehicle.id, { operationalStatus: "Out-of-Service" });
    expect(spy).toHaveBeenCalledTimes(1);

    // Becoming available again does not call it.
    await patch(user, vehicle.id, { operationalStatus: "Active", availableForRequisition: true });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("rolls back when the guard refuses", async () => {
    const user = await staff("TransportInCharge");
    vi.spyOn(allocationGuardService, "assertVehicleCanBecomeUnavailable").mockRejectedValue(
      Object.assign(new Error("blocked"), { status: 409 }),
    );
    const vehicle = await createVehicle();
    await patch(user, vehicle.id, { operationalStatus: "Under Maintenance" });
    expect((await vehicleRow(vehicle.id)).operational_status).toBe("Active");
    expect(await auditRows("vehicle.updated")).toHaveLength(0);
  });
});

describe("delete", () => {
  it("deletes an unreferenced vehicle", async () => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    expect((await del(user, vehicle.id)).status).toBe(204);
    expect(await vehicleRow(vehicle.id)).toBeUndefined();
    expect(await auditRows("vehicle.deleted")).toHaveLength(1);
    expect((await del(user, vehicle.id)).status).toBe(404);
  });

  it("is blocked by an allocation row", async () => {
    const user = await staff("TransportInCharge");
    const s = await createScenario();
    await createAllocation({
      requisitionId: s.requisition.id as string,
      tripId: s.trip.id as string,
      vehicleId: s.vehicle.id as string,
      allocatedBy: s.admin.id as string,
    });
    const res = await del(user, s.vehicle.id);
    expect(res.body.error.details).toMatchObject({ allocations: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("VEHICLE_HAS_HISTORY");
  });

  it("is blocked by an allocation_history row", async () => {
    const user = await staff("TransportInCharge");
    const vehicle = await createVehicle();
    await db("allocation_history").insert({
      trip_id: randomUUID(),
      requisition_id: "SUST-2026-0001",
      event: "assigned",
      vehicle_id: vehicle.id,
    });
    const res = await del(user, vehicle.id);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("VEHICLE_HAS_HISTORY");
    expect(res.body.error.details).toMatchObject({ allocationHistory: 1 });
  });
});

describe("driver deactivation through the vehicle API", () => {
  it("clears the vehicle's permanent driver", async () => {
    const user = await staff("TransportInCharge");
    const driver = await createDriver();
    const created = await post(user, {
      registrationNumber: "D-1",
      category: "Car",
      permanentDriverId: driver.id,
    });
    await request(app).post(`${BASE}/drivers/${driver.id}/deactivate`).set(bearer(user));
    const res = await get(user, `/${created.body.id}`);
    expect(res.body).not.toHaveProperty("permanentDriverId");
    expect(res.body).not.toHaveProperty("permanentDriver");
  });
});
