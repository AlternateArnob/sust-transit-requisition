import { describe, expect, it } from "vitest";
import { calendarDate, timeOfDay } from "../../src/http/fields.js";
import {
  createOffDayBody,
  listOffDaysQuery,
  updateOffDayBody,
} from "../../src/modules/offDays/offDay.schemas.js";
import { toOffDayDto, toOffDayLike } from "../../src/modules/offDays/offDay.mapper.js";

const VEHICLE = "7b1f6f0e-2f2a-4f43-9d52-4d2d0a1c8e11";

const issuePaths = (parse: () => unknown): string[] => {
  try {
    parse();
  } catch (error) {
    return (error as { issues: { path: PropertyKey[] }[] }).issues.map((issue) =>
      issue.path.map(String).join("."),
    );
  }
  return [];
};

describe("calendarDate and timeOfDay", () => {
  it("accepts real dates and rejects impossible or sloppy ones", () => {
    const date = calendarDate();
    expect(date.safeParse("2026-10-22").success).toBe(true);
    expect(date.safeParse("2028-02-29").success).toBe(true);
    for (const bad of [
      "2026-02-30",
      "2027-02-29",
      "2026-13-01",
      "2026-10-2",
      "22/10/2026",
      " 2026-10-22",
      "",
    ]) {
      expect(date.safeParse(bad).success, bad).toBe(false);
    }
  });

  it("accepts 24-hour HH:mm only", () => {
    const time = timeOfDay();
    for (const good of ["00:00", "09:00", "18:50", "23:59"]) {
      expect(time.safeParse(good).success, good).toBe(true);
    }
    for (const bad of ["24:00", "9:00", "09:60", "09:00:00", "0900", "9am", ""]) {
      expect(time.safeParse(bad).success, bad).toBe(false);
    }
  });
});

describe("createOffDayBody", () => {
  it("accepts a one-time off-day and a recurring one, normalising the reason", () => {
    expect(
      createOffDayBody.parse({ vehicleId: VEHICLE, type: "One-time", date: "2026-10-22" }),
    ).toEqual({ vehicleId: VEHICLE, type: "One-time", date: "2026-10-22", reason: null });
    expect(
      createOffDayBody.parse({
        vehicleId: VEHICLE,
        type: "Recurring",
        weekday: "Fri",
        reason: "  Weekly service  ",
      }),
    ).toEqual({ vehicleId: VEHICLE, type: "Recurring", weekday: "Fri", reason: "Weekly service" });
    expect(
      createOffDayBody.parse({ vehicleId: VEHICLE, type: "Recurring", weekday: "Fri", reason: " " })
        .reason,
    ).toBeNull();
  });

  it("enforces the shape rule in both directions", () => {
    expect(
      issuePaths(() => createOffDayBody.parse({ vehicleId: VEHICLE, type: "One-time" })),
    ).toEqual(["date"]);
    expect(
      issuePaths(() =>
        createOffDayBody.parse({
          vehicleId: VEHICLE,
          type: "One-time",
          date: "2026-10-22",
          weekday: "Thu",
        }),
      ),
    ).toEqual(["weekday"]);
    expect(
      issuePaths(() => createOffDayBody.parse({ vehicleId: VEHICLE, type: "Recurring" })),
    ).toEqual(["weekday"]);
    expect(
      issuePaths(() =>
        createOffDayBody.parse({
          vehicleId: VEHICLE,
          type: "Recurring",
          weekday: "Thu",
          date: "2026-10-22",
        }),
      ),
    ).toEqual(["date"]);
  });

  it("does not add a misleading shape error when the type itself is invalid", () => {
    expect(
      issuePaths(() => createOffDayBody.parse({ vehicleId: VEHICLE, type: "Weekly" })),
    ).toEqual(["type"]);
  });

  it("rejects unknown keys, a bad vehicle id, a bad date, a bad weekday and a long reason", () => {
    const base = { vehicleId: VEHICLE, type: "One-time", date: "2026-10-22" };
    expect(() => createOffDayBody.parse({ ...base, reservedFor: "x" })).toThrow();
    expect(() => createOffDayBody.parse({ ...base, vehicleId: "nope" })).toThrow();
    expect(() => createOffDayBody.parse({ ...base, date: "2026-02-30" })).toThrow();
    expect(() =>
      createOffDayBody.parse({ vehicleId: VEHICLE, type: "Recurring", weekday: "Monday" }),
    ).toThrow();
    expect(() => createOffDayBody.parse({ ...base, reason: "x".repeat(256) })).toThrow();
  });
});

describe("updateOffDayBody", () => {
  it("keeps absent fields absent and normalises a blank reason to null", () => {
    expect(updateOffDayBody.parse({})).toEqual({});
    expect(updateOffDayBody.parse({ reason: " " })).toEqual({ reason: null });
    expect(updateOffDayBody.parse({ reason: null })).toEqual({ reason: null });
  });

  it("does not accept a vehicle id (an off-day stays with its vehicle)", () => {
    expect(() => updateOffDayBody.parse({ vehicleId: VEHICLE })).toThrow();
  });
});

describe("listOffDaysQuery", () => {
  it("accepts an empty query, a vehicle and an ordered range", () => {
    expect(listOffDaysQuery.parse({})).toEqual({});
    expect(
      listOffDaysQuery.parse({ vehicleId: VEHICLE, from: "2026-10-01", to: "2026-10-01" }),
    ).toMatchObject({ from: "2026-10-01", to: "2026-10-01" });
  });

  it("rejects an inverted range, bad dates and unknown keys", () => {
    expect(
      issuePaths(() => listOffDaysQuery.parse({ from: "2026-10-02", to: "2026-10-01" })),
    ).toEqual(["to"]);
    expect(() => listOffDaysQuery.parse({ from: "yesterday" })).toThrow();
    expect(() => listOffDaysQuery.parse({ page: "1" })).toThrow();
  });
});

describe("off-day mapper", () => {
  const row = {
    id: "o1",
    vehicle_id: "v1",
    type: "One-time" as const,
    off_date: "2026-10-22",
    weekday: null,
    reason: null,
  };

  it("leaves out the field that does not apply and an empty reason", () => {
    expect(toOffDayDto(row)).toEqual({
      id: "o1",
      vehicleId: "v1",
      type: "One-time",
      date: "2026-10-22",
    });
    expect(
      toOffDayDto({ ...row, type: "Recurring", off_date: null, weekday: "Thu", reason: "Service" }),
    ).toEqual({ id: "o1", vehicleId: "v1", type: "Recurring", weekday: "Thu", reason: "Service" });
  });

  it("converts to the shape the domain functions use", () => {
    expect(toOffDayLike(row)).toEqual({
      vehicleId: "v1",
      type: "One-time",
      date: "2026-10-22",
      weekday: null,
    });
  });
});
