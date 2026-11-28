import { describe, expect, it } from "vitest";
import {
  scheduleLookupQuery,
  putTransportScheduleBody,
  transportScheduleParams,
} from "../../src/modules/transportSchedule/transportSchedule.schemas.js";
import {
  sameSchedule,
  toSchedule,
  toTransportScheduleDto,
} from "../../src/modules/transportSchedule/transportSchedule.mapper.js";

const paths = (parse: () => unknown): string[] => {
  try {
    parse();
  } catch (error) {
    return (error as { issues: { path: PropertyKey[] }[] }).issues.map((issue) =>
      issue.path.map(String).join("."),
    );
  }
  return [];
};

describe("putTransportScheduleBody", () => {
  it("keeps only weekdays that have a time, in Sun..Sat order", () => {
    const parsed = putTransportScheduleBody.parse({
      schedule: { Thu: "17:00", Mon: "18:50", Tue: "", Wed: null },
    });
    expect(parsed.schedule).toEqual({ Mon: "18:50", Thu: "17:00" });
    expect(Object.keys(parsed.schedule)).toEqual(["Mon", "Thu"]);
  });

  it("needs at least one weekday with a time", () => {
    expect(paths(() => putTransportScheduleBody.parse({ schedule: {} }))).toEqual(["schedule"]);
    expect(
      paths(() => putTransportScheduleBody.parse({ schedule: { Mon: "", Tue: null } })),
    ).toEqual(["schedule"]);
  });

  it("rejects bad times with the weekday in the path", () => {
    expect(paths(() => putTransportScheduleBody.parse({ schedule: { Mon: "25:00" } }))).toEqual([
      "schedule.Mon",
    ]);
    expect(paths(() => putTransportScheduleBody.parse({ schedule: { Mon: "9:00" } }))).toEqual([
      "schedule.Mon",
    ]);
  });

  it("rejects unknown weekdays, unknown keys and a missing schedule", () => {
    expect(() => putTransportScheduleBody.parse({ schedule: { Monday: "18:50" } })).toThrow();
    expect(() => putTransportScheduleBody.parse({ schedule: { Mon: "18:50" }, x: 1 })).toThrow();
    expect(() => putTransportScheduleBody.parse({})).toThrow();
  });
});

describe("params and lookup query", () => {
  it("validates the vehicle id and the lookup date", () => {
    expect(
      transportScheduleParams.safeParse({ vehicleId: "7b1f6f0e-2f2a-4f43-9d52-4d2d0a1c8e11" })
        .success,
    ).toBe(true);
    expect(transportScheduleParams.safeParse({ vehicleId: "x" }).success).toBe(false);
    expect(scheduleLookupQuery.safeParse({ date: "2026-10-22" }).success).toBe(true);
    expect(scheduleLookupQuery.safeParse({ date: "2026-02-30" }).success).toBe(false);
    expect(scheduleLookupQuery.safeParse({}).success).toBe(false);
    expect(scheduleLookupQuery.safeParse({ date: "2026-10-22", x: "1" }).success).toBe(false);
  });
});

describe("transport schedule mapper", () => {
  const slots = [
    { entry_id: "e1", weekday: "Thu" as const, free_after: "17:00:00" },
    { entry_id: "e1", weekday: "Mon" as const, free_after: "18:50:00" },
  ];

  it("turns TIME values into HH:mm and orders the weekdays Sun..Sat", () => {
    const dto = toTransportScheduleDto({ id: "e1", vehicle_id: "v1" }, slots);
    expect(dto).toEqual({ id: "e1", vehicleId: "v1", schedule: { Mon: "18:50", Thu: "17:00" } });
    expect(Object.keys(dto.schedule)).toEqual(["Mon", "Thu"]);
  });

  it("compares schedules by weekday and time", () => {
    expect(sameSchedule(toSchedule(slots), { Thu: "17:00", Mon: "18:50" })).toBe(true);
    expect(sameSchedule(toSchedule(slots), { Mon: "18:50" })).toBe(false);
    expect(sameSchedule(toSchedule(slots), { Mon: "18:51", Thu: "17:00" })).toBe(false);
    expect(sameSchedule({}, {})).toBe(true);
  });
});
