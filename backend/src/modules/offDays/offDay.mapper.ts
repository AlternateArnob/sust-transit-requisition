import type { OffDayType, Weekday } from "../../config/constants.js";
import type { OffDayLike } from "../../types/index.js";

/** A `vehicle_off_days` row (DATE columns arrive as `YYYY-MM-DD` strings). */
export interface OffDayRow {
  id: string;
  vehicle_id: string;
  type: OffDayType;
  off_date: string | null;
  weekday: Weekday | null;
  reason: string | null;
}

/** Part 1 §12.11 and the frontend's `VehicleOffDay`: `date` only when One-time, `weekday` only when Recurring. */
export interface OffDayDto {
  id: string;
  vehicleId: string;
  type: OffDayType;
  date?: string;
  weekday?: Weekday;
  reason?: string;
}

export function toOffDayDto(row: OffDayRow): OffDayDto {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    type: row.type,
    ...(row.off_date ? { date: row.off_date } : {}),
    ...(row.weekday ? { weekday: row.weekday } : {}),
    ...(row.reason ? { reason: row.reason } : {}),
  };
}

/** The shape the pure domain functions (`src/domain/schedule.ts`) work on. */
export function toOffDayLike(row: OffDayRow): OffDayLike {
  return { vehicleId: row.vehicle_id, type: row.type, date: row.off_date, weekday: row.weekday };
}
