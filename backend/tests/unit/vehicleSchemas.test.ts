import { describe, expect, it } from "vitest";
import { toVehicleDetailDto, toVehicleDto, type VehicleRow } from "../../src/modules/vehicles/vehicle.mapper.js";
import {
  createVehicleBody,
  normalizeRegistration,
  updateVehicleBody,
} from "../../src/modules/vehicles/vehicle.schemas.js";
import { becomesUnavailable, isVehicleEligibleForRequisition } from "../../src/domain/vehicleEligibility.js";

describe("vehicle schemas", () => {
  it("normalizes registrations", () => {
    expect(normalizeRegistration("  sylhet   cha 11 ")).toBe("SYLHET CHA 11");
    const parsed = createVehicleBody.parse({ registrationNumber: " ab-1 ", category: "Car" });
    expect(parsed).toMatchObject({
      registrationNumber: "AB-1",
      fuelType: null,
      operationalStatus: "Active",
      availableForRequisition: true,
      permanentDriverId: null,
    });
  });

  it("rejects bad categories, statuses and unknown keys", () => {
    expect(() => createVehicleBody.parse({ registrationNumber: "A", category: "Tractor" })).toThrow();
    expect(() =>
      createVehicleBody.parse({ registrationNumber: "A", category: "Car", reservedFor: "x" }),
    ).toThrow();
    expect(() => updateVehicleBody.parse({ operationalStatus: "Broken" })).toThrow();
  });

  it("keeps absent update fields absent and accepts null to clear", () => {
    expect(updateVehicleBody.parse({})).toEqual({});
    expect(updateVehicleBody.parse({ permanentDriverId: null, fuelType: " " })).toEqual({
      permanentDriverId: null,
      fuelType: null,
    });
  });
});

describe("vehicle mapper", () => {
  const row: VehicleRow = {
    id: "v1",
    registration_number: "A-1",
    category: "Car",
    fuel_type: null,
    operational_status: "Active",
    available_for_requisition: 1,
    permanent_driver_id: null,
    driver_name: null,
    driver_designation: null,
    driver_phone: null,
    driver_status: null,
  };

  it("leaves out empty optionals and never exposes reservedFor", () => {
    const dto = toVehicleDto(row);
    expect(dto).toEqual({
      id: "v1",
      registrationNumber: "A-1",
      category: "Car",
      operationalStatus: "Active",
      availableForRequisition: true,
    });
  });

  it("adds the driver summary in the detail view", () => {
    const detail = toVehicleDetailDto({
      ...row,
      permanent_driver_id: "d1",
      driver_name: "Rahim",
      driver_designation: "Driver",
      driver_status: "Active",
    });
    expect(detail.permanentDriver).toEqual({
      id: "d1",
      name: "Rahim",
      designation: "Driver",
      status: "Active",
    });
  });
});

describe("availability helpers", () => {
  const ok = { operationalStatus: "Active", availableForRequisition: true } as const;
  it("detects the move to unavailable", () => {
    expect(isVehicleEligibleForRequisition(ok)).toBe(true);
    expect(becomesUnavailable(ok, { ...ok, availableForRequisition: false })).toBe(true);
    expect(becomesUnavailable(ok, { ...ok, operationalStatus: "Out-of-Service" })).toBe(true);
    expect(
      becomesUnavailable(
        { ...ok, availableForRequisition: false },
        { ...ok, operationalStatus: "Out-of-Service" },
      ),
    ).toBe(false);
    expect(becomesUnavailable({ ...ok, availableForRequisition: false }, ok)).toBe(false);
  });
});
