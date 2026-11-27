import { describe, expect, it } from "vitest";
import { toDriverDto } from "../../src/modules/drivers/driver.mapper.js";
import {
  createDriverBody,
  driverIdParams,
  listDriversQuery,
  updateDriverBody,
} from "../../src/modules/drivers/driver.schemas.js";

describe("createDriverBody", () => {
  it("trims the name and turns a missing, blank or null phone into null", () => {
    for (const phone of [undefined, "", null]) {
      const parsed = createDriverBody.parse({ name: " A ", designation: "Driver", phone });
      expect(parsed).toEqual({ name: "A", designation: "Driver", phone: null });
    }
  });

  it("rejects a phone that is only spaces (it is not a number)", () => {
    expect(
      createDriverBody.safeParse({ name: "A", designation: "Driver", phone: "   " }).success,
    ).toBe(false);
  });

  it("keeps a valid phone number, trimmed", () => {
    expect(
      createDriverBody.parse({ name: "A", designation: "Driver", phone: " +880 1711-111111 " })
        .phone,
    ).toBe("+880 1711-111111");
  });

  it("rejects unknown keys", () => {
    expect(
      createDriverBody.safeParse({ name: "A", designation: "Driver", status: "Active" }).success,
    ).toBe(false);
  });
});

describe("updateDriverBody", () => {
  it("accepts an empty object (nothing to change)", () => {
    expect(updateDriverBody.parse({})).toEqual({});
  });

  it("maps a blank phone to null and leaves an absent phone absent", () => {
    expect(updateDriverBody.parse({ phone: "" })).toEqual({ phone: null });
    expect(updateDriverBody.parse({ phone: null })).toEqual({ phone: null });
    expect(updateDriverBody.parse({ name: "B" })).toEqual({ name: "B" });
  });

  it("does not allow status or the vehicle link", () => {
    expect(updateDriverBody.safeParse({ status: "Inactive" }).success).toBe(false);
    expect(updateDriverBody.safeParse({ permanentVehicleId: "x" }).success).toBe(false);
  });
});

describe("listDriversQuery / driverIdParams", () => {
  it("accepts the documented filters only", () => {
    expect(listDriversQuery.parse({ status: "Active", q: " rahim " })).toEqual({
      status: "Active",
      q: "rahim",
    });
    expect(listDriversQuery.safeParse({ status: "Gone" }).success).toBe(false);
    expect(listDriversQuery.safeParse({ page: "2" }).success).toBe(false);
  });

  it("requires a UUID", () => {
    expect(driverIdParams.safeParse({ id: "123" }).success).toBe(false);
    expect(driverIdParams.safeParse({ id: "7f1b9f8e-3c1a-4d5e-9a3b-2f6c8d1e4a5b" }).success).toBe(
      true,
    );
  });
});

describe("toDriverDto", () => {
  const row = {
    id: "d1",
    name: "A",
    designation: "Driver" as const,
    phone: null,
    status: "Active" as const,
    permanent_vehicle_id: null,
  };

  it("leaves out an empty phone and an absent vehicle link", () => {
    expect(toDriverDto(row)).toEqual({
      id: "d1",
      name: "A",
      designation: "Driver",
      status: "Active",
    });
  });

  it("includes the phone and the computed vehicle link when present", () => {
    expect(toDriverDto({ ...row, phone: "01711-000000", permanent_vehicle_id: "v1" })).toEqual({
      id: "d1",
      name: "A",
      designation: "Driver",
      phone: "01711-000000",
      status: "Active",
      permanentVehicleId: "v1",
    });
  });
});
