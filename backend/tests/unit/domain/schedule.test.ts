import { describe, expect, it } from "vitest";
import {
  formatTimeDisplay,
  getOffDayForVehicleOnDate,
  getScheduledDays,
  getStudentTransportEntry,
  getStudentTransportTimeForDate,
  getWeekdayFromDate,
  isVehicleFreeAtTime,
  isVehicleOnOffDay,
  todayString,
  toMinutes,
} from "../../../src/domain/schedule.js";
import type { StudentTransportEntryLike } from "../../../src/types/index.js";
import { offDay } from "../../helpers/builders.js";

describe("getWeekdayFromDate", () => {
  it("2026-10-22 is a Thursday", () => {
    expect(getWeekdayFromDate("2026-10-22")).toBe("Thu");
  });

  it("indexes the week from Sunday", () => {
    expect(getWeekdayFromDate("2026-10-25")).toBe("Sun");
    expect(getWeekdayFromDate("2026-10-26")).toBe("Mon");
    expect(getWeekdayFromDate("2026-10-24")).toBe("Sat");
  });

  it("handles leap days and year boundaries", () => {
    expect(getWeekdayFromDate("2028-02-29")).toBe("Tue");
    expect(getWeekdayFromDate("2026-01-01")).toBe("Thu");
    expect(getWeekdayFromDate("2026-12-31")).toBe("Thu");
  });

  it.each([
    "2026-02-30",
    "2026-13-01",
    "2026-00-10",
    "2027-02-29",
    "22-10-2026",
    "2026-10-22T00:00",
    "",
    "tomorrow",
  ])("throws on the invalid date %j", (value) => {
    expect(() => getWeekdayFromDate(value)).toThrow(RangeError);
  });
});

describe("todayString (Asia/Dhaka)", () => {
  it("rolls over to the next day at 18:00 UTC, because Dhaka is UTC+6", () => {
    expect(todayString(new Date("2026-10-21T17:59:59Z"))).toBe("2026-10-21");
    expect(todayString(new Date("2026-10-21T18:00:00Z"))).toBe("2026-10-22");
    expect(todayString(new Date("2026-10-21T20:00:00Z"))).toBe("2026-10-22");
  });

  it("accepts another time zone", () => {
    expect(todayString(new Date("2026-10-21T20:00:00Z"), "UTC")).toBe("2026-10-21");
  });

  it("always returns YYYY-MM-DD", () => {
    expect(todayString(new Date("2026-01-05T10:00:00Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("toMinutes", () => {
  it("converts HH:mm and HH:mm:ss", () => {
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("09:30")).toBe(570);
    expect(toMinutes("23:59:59")).toBe(1439);
  });
});

describe("off-days", () => {
  it("a one-time off-day matches only its date", () => {
    const days = [offDay({ type: "One-time", date: "2026-10-22" })];
    expect(getOffDayForVehicleOnDate("veh-1", "2026-10-22", days)).toBe(days[0]);
    expect(getOffDayForVehicleOnDate("veh-1", "2026-10-23", days)).toBeUndefined();
  });

  it("a recurring off-day matches every date on that weekday", () => {
    const days = [offDay({ type: "Recurring", date: null, weekday: "Thu" })];
    expect(isVehicleOnOffDay("veh-1", "2026-10-22", days)).toBe(true);
    expect(isVehicleOnOffDay("veh-1", "2026-10-29", days)).toBe(true);
    expect(isVehicleOnOffDay("veh-1", "2026-10-23", days)).toBe(false);
  });

  it("ignores other vehicles' off-days", () => {
    const days = [offDay({ vehicleId: "veh-2" })];
    expect(isVehicleOnOffDay("veh-1", "2026-10-22", days)).toBe(false);
  });

  it("a one-time off-day does not repeat weekly", () => {
    const days = [offDay({ type: "One-time", date: "2026-10-22" })];
    expect(isVehicleOnOffDay("veh-1", "2026-10-29", days)).toBe(false);
  });
});

describe("student-transport schedule", () => {
  const entries: StudentTransportEntryLike[] = [
    { vehicleId: "veh-1", schedule: { Mon: "14:30", Thu: "09:00" } },
  ];

  it("finds the entry and the free-after time per weekday", () => {
    expect(getStudentTransportEntry("veh-1", entries)).toBe(entries[0]);
    expect(getStudentTransportEntry("veh-9", entries)).toBeUndefined();
    expect(getStudentTransportTimeForDate("veh-1", "2026-10-26", entries)).toBe("14:30"); // Monday
    expect(getStudentTransportTimeForDate("veh-1", "2026-10-22", entries)).toBe("09:00"); // Thursday
  });

  it("has no time on a weekday without an entry, or for a vehicle without a schedule", () => {
    expect(getStudentTransportTimeForDate("veh-1", "2026-10-27", entries)).toBeUndefined(); // Tuesday
    expect(getStudentTransportTimeForDate("veh-9", "2026-10-26", entries)).toBeUndefined();
  });

  it("is free at or after the free-after time, not before", () => {
    expect(isVehicleFreeAtTime("veh-1", "2026-10-26", "14:29", entries)).toBe(false);
    expect(isVehicleFreeAtTime("veh-1", "2026-10-26", "14:30", entries)).toBe(true);
    expect(isVehicleFreeAtTime("veh-1", "2026-10-26", "18:00", entries)).toBe(true);
  });

  it("is free all day when there is no entry for that vehicle or weekday", () => {
    expect(isVehicleFreeAtTime("veh-1", "2026-10-27", "06:00", entries)).toBe(true);
    expect(isVehicleFreeAtTime("veh-9", "2026-10-26", "06:00", entries)).toBe(true);
  });

  it("lists scheduled days in Sun..Sat order", () => {
    expect(getScheduledDays({ Thu: "09:00", Sun: "13:00", Tue: "10:00" })).toEqual([
      "Sun",
      "Tue",
      "Thu",
    ]);
    expect(getScheduledDays({})).toEqual([]);
  });
});

describe("formatTimeDisplay", () => {
  it.each([
    ["00:00", "12:00 AM"],
    ["09:05", "9:05 AM"],
    ["12:00", "12:00 PM"],
    ["14:30", "2:30 PM"],
    ["23:59", "11:59 PM"],
  ])("%s -> %s", (input, expected) => {
    expect(formatTimeDisplay(input)).toBe(expected);
  });
});
