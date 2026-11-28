import { z } from "zod";
import { WEEKDAYS } from "../../config/constants.js";
import { calendarDate, timeOfDay } from "../../http/fields.js";
import type { StudentTransportSchedule } from "../../types/index.js";

/** "HH:mm"; `""` or `null` means free all day that weekday (same as leaving the key out). */
const freeAfter = z.union([timeOfDay(), z.literal(""), z.null()]).optional();

const weekdaySlots = {
  Sun: freeAfter,
  Mon: freeAfter,
  Tue: freeAfter,
  Wed: freeAfter,
  Thu: freeAfter,
  Fri: freeAfter,
  Sat: freeAfter,
};

/** Keeps only the weekdays that have a time, in Sun..Sat order. */
const toSchedule = (raw: Partial<Record<(typeof WEEKDAYS)[number], string | null | undefined>>) => {
  const schedule: StudentTransportSchedule = {};
  for (const day of WEEKDAYS) {
    const value = raw[day];
    if (value) schedule[day] = value;
  }
  return schedule;
};

/**
 * The whole entry for one vehicle (PUT replaces it). At least one weekday needs a time, as in the
 * frontend form; to make a vehicle free all day again, delete its entry instead.
 */
export const putTransportScheduleBody = z.strictObject({
  schedule: z
    .strictObject(weekdaySlots)
    .transform(toSchedule)
    .refine((schedule) => Object.keys(schedule).length > 0, {
      message:
        "Add a free-after time for at least one weekday, or delete the entry to make the vehicle free all day.",
    }),
});

export const transportScheduleParams = z.strictObject({
  vehicleId: z.uuid("Invalid vehicle id."),
});

export const scheduleLookupQuery = z.strictObject({
  date: calendarDate(),
});

export type PutTransportScheduleBody = z.output<typeof putTransportScheduleBody>;
export type ScheduleLookupQuery = z.output<typeof scheduleLookupQuery>;
