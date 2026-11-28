import { toHourMinute } from "../../db/time.js";
import {
  getOffDayForVehicleOnDate,
  getStudentTransportTimeForDate,
  getWeekdayFromDate,
} from "../../domain/schedule.js";
import type { Weekday } from "../../config/constants.js";
import type { StudentTransportEntryLike } from "../../types/index.js";
import { toOffDayDto, toOffDayLike, type OffDayDto } from "../offDays/offDay.mapper.js";
import { listOffDayRowsApplyingOn } from "../offDays/offDay.repository.js";
import { listVehicles } from "../vehicles/vehicle.repository.js";
import { listAllocationsOnDate, listSlotsOnWeekday } from "./transportSchedule.repository.js";

/** One vehicle's commitments on one date (Part 1 §12.12, "Schedule Lookup"). */
export interface VehicleDayDto {
  vehicleId: string;
  registrationNumber: string;
  onOffDay: boolean;
  offDayInfo?: OffDayDto;
  /** "HH:mm"; absent when the vehicle has no student-transport entry that weekday. */
  studentTransportFreeAfter?: string;
  allocations: {
    tripId: string;
    requisitionId: string;
    startTime: string;
    endTime: string;
    /** Added beside the fields of §12.12: the lookup page shows it for each allocation. */
    purpose: string;
  }[];
}

export interface ScheduleLookupDto {
  date: string;
  weekday: Weekday;
  data: VehicleDayDto[];
}

/**
 * Every vehicle with its off-day, student-transport "free after" time and allocations on `date`.
 * The off-day and free-after rules come from the same domain functions the allocation rules use,
 * so this page and the allocation check can never disagree. Four queries, whatever the fleet size.
 */
export async function lookup(date: string): Promise<ScheduleLookupDto> {
  const weekday = getWeekdayFromDate(date);
  const [vehicles, offDayRows, slots, allocations] = await Promise.all([
    listVehicles({}),
    listOffDayRowsApplyingOn(date, weekday),
    listSlotsOnWeekday(weekday),
    listAllocationsOnDate(date),
  ]);

  // Keep the row next to its domain shape: the domain function returns one of these objects.
  const rowByLike = new Map(offDayRows.map((row) => [toOffDayLike(row), row]));
  const offDayLikes = [...rowByLike.keys()];

  const entries: StudentTransportEntryLike[] = slots.map((slot) => ({
    vehicleId: slot.vehicle_id,
    schedule: { [slot.weekday]: toHourMinute(slot.free_after) },
  }));

  const data = vehicles.map((vehicle): VehicleDayDto => {
    const match = getOffDayForVehicleOnDate(vehicle.id, date, offDayLikes);
    const offDayRow = match ? rowByLike.get(match) : undefined;
    const freeAfter = getStudentTransportTimeForDate(vehicle.id, date, entries);

    return {
      vehicleId: vehicle.id,
      registrationNumber: vehicle.registration_number,
      onOffDay: offDayRow !== undefined,
      ...(offDayRow ? { offDayInfo: toOffDayDto(offDayRow) } : {}),
      ...(freeAfter ? { studentTransportFreeAfter: freeAfter } : {}),
      allocations: allocations
        .filter((allocation) => allocation.vehicle_id === vehicle.id)
        .map((allocation) => ({
          tripId: allocation.trip_id,
          requisitionId: allocation.requisition_id,
          startTime: toHourMinute(allocation.start_time),
          endTime: toHourMinute(allocation.end_time),
          purpose: allocation.purpose,
        })),
    };
  });

  return { date, weekday, data };
}
