import { WEEKDAYS, type Weekday } from "../../config/constants.js";
import { toHourMinute } from "../../db/time.js";
import type { StudentTransportEntryLike, StudentTransportSchedule } from "../../types/index.js";

/** A `student_transport_vehicles` row. */
export interface ScheduleEntryRow {
  id: string;
  vehicle_id: string;
}

/** A `student_transport_slots` row (`free_after` arrives as "HH:mm:ss"). */
export interface ScheduleSlotRow {
  entry_id: string;
  weekday: Weekday;
  free_after: string;
}

/** Part 1 §12.12 and the frontend's `StudentTransportVehicle`. A weekday without a key is free all day. */
export interface TransportScheduleDto {
  id: string;
  vehicleId: string;
  schedule: StudentTransportSchedule;
}

/** Slot rows -> `{ Sun?: "HH:mm", ... }`, always in Sun..Sat order. */
export function toSchedule(slots: ScheduleSlotRow[]): StudentTransportSchedule {
  const byDay = new Map(slots.map((slot) => [slot.weekday, toHourMinute(slot.free_after)]));
  const schedule: StudentTransportSchedule = {};
  for (const day of WEEKDAYS) {
    const time = byDay.get(day);
    if (time) schedule[day] = time;
  }
  return schedule;
}

export function toTransportScheduleDto(
  entry: ScheduleEntryRow,
  slots: ScheduleSlotRow[],
): TransportScheduleDto {
  return { id: entry.id, vehicleId: entry.vehicle_id, schedule: toSchedule(slots) };
}

export const toScheduleLike = (
  entry: ScheduleEntryRow,
  slots: ScheduleSlotRow[],
): StudentTransportEntryLike => ({ vehicleId: entry.vehicle_id, schedule: toSchedule(slots) });

/** True when both schedules have the same times on the same weekdays. */
export const sameSchedule = (a: StudentTransportSchedule, b: StudentTransportSchedule): boolean =>
  WEEKDAYS.every((day) => (a[day] ?? null) === (b[day] ?? null));
