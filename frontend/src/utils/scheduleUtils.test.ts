import { describe, expect, it } from "vitest";
import type { StudentTransportVehicle, VehicleOffDay } from "../types";
import {
  formatTimeDisplay,
  getOffDayForVehicleOnDate,
  getWeekdayFromDate,
  isVehicleFreeAtTime,
} from "./scheduleUtils";

const oneTime: VehicleOffDay = { id: "o1", vehicleId: "V1", type: "One-time", date: "2026-03-10" };
const recurring: VehicleOffDay = { id: "o2", vehicleId: "V2", type: "Recurring", weekday: "Fri" };

describe("scheduleUtils", () => {
  it("getWeekdayFromDate maps dates to weekdays", () => {
    expect(getWeekdayFromDate("2026-03-10")).toBe("Tue");
  });

  it("finds one-time and recurring off-days", () => {
    expect(getOffDayForVehicleOnDate("V1", "2026-03-10", [oneTime, recurring])).toBe(oneTime);
    expect(getOffDayForVehicleOnDate("V1", "2026-03-11", [oneTime, recurring])).toBeUndefined();
    expect(getOffDayForVehicleOnDate("V2", "2026-03-13", [oneTime, recurring])).toBe(recurring);
    expect(getOffDayForVehicleOnDate("V2", "2026-03-12", [oneTime, recurring])).toBeUndefined();
  });

  it("isVehicleFreeAtTime respects the student transport free-after time", () => {
    const schedules: StudentTransportVehicle[] = [
      { id: "s1", vehicleId: "V1", schedule: { Tue: "10:00" } },
    ];
    expect(isVehicleFreeAtTime("V1", "2026-03-10", "09:59", schedules)).toBe(false);
    expect(isVehicleFreeAtTime("V1", "2026-03-10", "10:00", schedules)).toBe(true);
    expect(isVehicleFreeAtTime("V1", "2026-03-11", "08:00", schedules)).toBe(true);
    expect(isVehicleFreeAtTime("V9", "2026-03-10", "08:00", schedules)).toBe(true);
  });

  it("formatTimeDisplay uses a 12-hour clock", () => {
    expect(formatTimeDisplay("00:05")).toBe("12:05 AM");
    expect(formatTimeDisplay("13:30")).toBe("1:30 PM");
  });
});
