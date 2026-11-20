import { describe, expect, it } from "vitest";
import type { Allocation, StudentTransportVehicle, Trip, Vehicle, VehicleOffDay } from "../types";
import { getVehicleEligibility, timeRangesOverlap } from "./allocationUtils";

const vehicle: Vehicle = {
  id: "V1",
  registrationNumber: "DHAKA-1",
  category: "Car",
  operationalStatus: "Active",
  availableForRequisition: true,
  permanentDriverId: "D1",
};

const trip = {
  id: "T1",
  date: "2026-03-10",
  startTime: "09:00",
  endTime: "11:00",
  vehicleCategory: "Car",
} as unknown as Trip;

const empty = { allocations: [] as Allocation[], offDays: [] as VehicleOffDay[], schedules: [] as StudentTransportVehicle[] };

describe("timeRangesOverlap", () => {
  it("treats touching ranges as not overlapping", () => {
    expect(timeRangesOverlap("09:00", "10:00", "10:00", "11:00")).toBe(false);
    expect(timeRangesOverlap("09:00", "10:30", "10:00", "11:00")).toBe(true);
  });
});

describe("getVehicleEligibility", () => {
  it("accepts a free, active vehicle with a driver", () => {
    expect(getVehicleEligibility(vehicle, trip, empty).eligible).toBe(true);
  });

  it("blocks a vehicle under maintenance", () => {
    const result = getVehicleEligibility({ ...vehicle, operationalStatus: "Under Maintenance" }, trip, empty);
    expect(result.eligible).toBe(false);
  });

  it("blocks a vehicle that is not available for requisition", () => {
    expect(getVehicleEligibility({ ...vehicle, availableForRequisition: false }, trip, empty).eligible).toBe(false);
  });

  it("blocks a vehicle without a permanent driver", () => {
    expect(getVehicleEligibility({ ...vehicle, permanentDriverId: undefined }, trip, empty).eligible).toBe(false);
  });

  it("blocks an off-day", () => {
    const offDays: VehicleOffDay[] = [{ id: "o", vehicleId: "V1", type: "One-time", date: "2026-03-10" }];
    expect(getVehicleEligibility(vehicle, trip, { ...empty, offDays }).eligible).toBe(false);
  });

  it("blocks a double booking but not when that allocation is excluded", () => {
    const allocations: Allocation[] = [
      { id: "A1", requisitionId: "R", tripId: "T0", vehicleId: "V1", date: "2026-03-10", startTime: "10:00", endTime: "12:00", allocatedAt: "" },
    ];
    expect(getVehicleEligibility(vehicle, trip, { ...empty, allocations }).eligible).toBe(false);
    expect(getVehicleEligibility(vehicle, trip, { ...empty, allocations, excludeAllocationId: "A1" }).eligible).toBe(true);
  });

  it("blocks a student transport clash", () => {
    const schedules: StudentTransportVehicle[] = [{ id: "s", vehicleId: "V1", schedule: { Tue: "10:00" } }];
    expect(getVehicleEligibility(vehicle, trip, { ...empty, schedules }).eligible).toBe(false);
  });
});
