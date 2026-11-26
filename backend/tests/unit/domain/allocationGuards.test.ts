import { describe, expect, it } from "vitest";
import {
  describeAllocations,
  getAllocationsBlockedByOffDay,
  getAllocationsBlockedByStudentTransport,
  getAllocationsBlockedByUnavailability,
  getUpcomingAllocationsForVehicle,
  toAllocationConflictDetails,
} from "../../../src/domain/allocationGuards.js";
import { allocation } from "../../helpers/builders.js";

const TODAY = "2026-10-22"; // Thursday

const past = allocation({ date: "2026-10-21", startTime: "08:00", endTime: "10:00" });
const today = allocation({ date: "2026-10-22", startTime: "09:00", endTime: "11:00" });
const nextThursday = allocation({ date: "2026-10-29", startTime: "09:00", endTime: "11:00" });
const friday = allocation({ date: "2026-10-23", startTime: "13:00", endTime: "15:00" });
const otherVehicle = allocation({ vehicleId: "veh-2", date: "2026-10-22" });
const all = [past, today, nextThursday, friday, otherVehicle];

describe("upcoming allocations", () => {
  it("counts today and the future, never the past", () => {
    expect(getUpcomingAllocationsForVehicle("veh-1", all, TODAY)).toEqual([
      today,
      nextThursday,
      friday,
    ]);
  });

  it("only returns the given vehicle's allocations", () => {
    expect(getUpcomingAllocationsForVehicle("veh-2", all, TODAY)).toEqual([otherVehicle]);
    expect(getUpcomingAllocationsForVehicle("veh-9", all, TODAY)).toEqual([]);
  });

  it("an allocation dated yesterday is history and never blocks", () => {
    expect(getUpcomingAllocationsForVehicle("veh-1", [past], TODAY)).toEqual([]);
  });
});

describe("unavailability guard (Under Maintenance / Out-of-Service / not available)", () => {
  it("blocks while there is any upcoming allocation", () => {
    expect(getAllocationsBlockedByUnavailability("veh-1", all, TODAY)).toEqual([
      today,
      nextThursday,
      friday,
    ]);
  });

  it("does not block when only past allocations exist", () => {
    expect(getAllocationsBlockedByUnavailability("veh-1", [past], TODAY)).toEqual([]);
  });
});

describe("off-day guard", () => {
  it("a one-time off-day blocks only the allocation on that date", () => {
    expect(
      getAllocationsBlockedByOffDay("veh-1", { type: "One-time", date: "2026-10-23" }, all, TODAY),
    ).toEqual([friday]);
  });

  it("a one-time off-day on a date with no allocation blocks nothing", () => {
    expect(
      getAllocationsBlockedByOffDay("veh-1", { type: "One-time", date: "2026-11-30" }, all, TODAY),
    ).toEqual([]);
  });

  it("a one-time off-day in the past never blocks", () => {
    expect(
      getAllocationsBlockedByOffDay("veh-1", { type: "One-time", date: "2026-10-21" }, all, TODAY),
    ).toEqual([]);
  });

  it("a recurring off-day blocks every upcoming allocation on that weekday", () => {
    expect(
      getAllocationsBlockedByOffDay("veh-1", { type: "Recurring", weekday: "Thu" }, all, TODAY),
    ).toEqual([today, nextThursday]);
  });

  it("a recurring off-day ignores past allocations on that weekday", () => {
    const pastThursday = allocation({ date: "2026-10-15" });
    expect(
      getAllocationsBlockedByOffDay(
        "veh-1",
        { type: "Recurring", weekday: "Thu" },
        [pastThursday],
        TODAY,
      ),
    ).toEqual([]);
  });

  it("another vehicle's allocation on the same date is untouched", () => {
    const blocked = getAllocationsBlockedByOffDay(
      "veh-1",
      { type: "One-time", date: "2026-10-22" },
      all,
      TODAY,
    );
    expect(blocked).toEqual([today]);
  });
});

describe("student-transport guard", () => {
  it("blocks upcoming allocations that start before the free-after time that weekday", () => {
    // friday allocation starts 13:00; free after 14:00 on Friday -> blocked
    expect(getAllocationsBlockedByStudentTransport("veh-1", { Fri: "14:00" }, all, TODAY)).toEqual([
      friday,
    ]);
  });

  it("an allocation starting exactly at the free-after time is fine", () => {
    expect(getAllocationsBlockedByStudentTransport("veh-1", { Fri: "13:00" }, all, TODAY)).toEqual(
      [],
    );
  });

  it("an allocation starting after the free-after time is fine", () => {
    expect(getAllocationsBlockedByStudentTransport("veh-1", { Fri: "12:00" }, all, TODAY)).toEqual(
      [],
    );
  });

  it("weekdays without an entry never block", () => {
    expect(getAllocationsBlockedByStudentTransport("veh-1", { Mon: "23:00" }, all, TODAY)).toEqual(
      [],
    );
  });

  it("past allocations never block", () => {
    expect(
      getAllocationsBlockedByStudentTransport("veh-1", { Wed: "23:00" }, [past], TODAY),
    ).toEqual([]);
  });

  it("checks every scheduled weekday", () => {
    expect(
      getAllocationsBlockedByStudentTransport("veh-1", { Thu: "10:00", Fri: "14:00" }, all, TODAY),
    ).toEqual([today, nextThursday, friday]);
  });
});

describe("helpers for the 409 responses", () => {
  it("maps allocations to the details shape of Part 1 §11.9", () => {
    expect(toAllocationConflictDetails([friday])).toEqual([
      {
        allocationId: friday.id,
        requisitionId: friday.requisitionId,
        tripId: friday.tripId,
        date: "2026-10-23",
        startTime: "13:00",
        endTime: "15:00",
      },
    ]);
  });

  it("describes allocations in date/time order", () => {
    expect(describeAllocations([friday, today])).toBe(
      "2026-10-22 09:00–11:00, 2026-10-23 13:00–15:00",
    );
    expect(describeAllocations([])).toBe("");
  });
});
