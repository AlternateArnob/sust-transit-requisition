import { describe, expect, it } from "vitest";
import type { Allocation } from "@/types";
import {
  describeAllocations,
  getAllocationsBlockedByOffDay,
  getAllocationsBlockedByStudentTransport,
  getAllocationsBlockedByUnavailability,
} from "./allocationGuards";

const make = (
  id: string,
  vehicleId: string,
  date: string,
  start = "09:00",
  end = "11:00",
): Allocation => ({
  id,
  requisitionId: "R",
  tripId: id,
  vehicleId,
  date,
  startTime: start,
  endTime: end,
  allocatedAt: "",
});

const TODAY = "2026-03-10";
const list = [
  make("past", "V1", "2026-03-03"),
  make("today", "V1", "2026-03-10"),
  make("next", "V1", "2026-03-17", "08:00", "09:00"),
  make("other", "V2", "2026-03-10"),
];

describe("allocation guards", () => {
  it("ignores past allocations and other vehicles when taking a vehicle out of service", () => {
    expect(getAllocationsBlockedByUnavailability("V1", list, TODAY).map((a) => a.id)).toEqual([
      "today",
      "next",
    ]);
  });

  it("blocks a one-time off-day only on the matching date", () => {
    const blocked = getAllocationsBlockedByOffDay(
      "V1",
      { type: "One-time", date: "2026-03-17" },
      list,
      TODAY,
    );
    expect(blocked.map((a) => a.id)).toEqual(["next"]);
  });

  it("blocks a recurring off-day on every upcoming matching weekday but not the past", () => {
    const blocked = getAllocationsBlockedByOffDay(
      "V1",
      { type: "Recurring", weekday: "Tue" },
      list,
      TODAY,
    );
    expect(blocked.map((a) => a.id)).toEqual(["today", "next"]);
  });

  it("blocks a student transport slot only when the trip starts before the free-after time", () => {
    const blocked = getAllocationsBlockedByStudentTransport("V1", { Tue: "08:30" }, list, TODAY);
    expect(blocked.map((a) => a.id)).toEqual(["next"]);
    expect(getAllocationsBlockedByStudentTransport("V1", { Wed: "23:00" }, list, TODAY)).toEqual(
      [],
    );
  });

  it("describes allocations in date order", () => {
    expect(describeAllocations([list[2], list[1]])).toBe(
      "2026-03-10 09:00–11:00, 2026-03-17 08:00–09:00",
    );
  });
});
