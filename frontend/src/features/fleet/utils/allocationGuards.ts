import type { Allocation, OffDayType, StudentTransportSchedule, Weekday } from "@/types";
import { getWeekdayFromDate, todayString } from "./scheduleUtils";

/**
 * Guards that stop a change to a vehicle from stranding trips that are
 * already allocated to it. Only today's and future allocations count:
 * past trips are history and must never block a vehicle.
 */

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function getUpcomingAllocationsForVehicle(
  vehicleId: string,
  allocations: Allocation[],
  today: string = todayString(),
): Allocation[] {
  return allocations.filter(
    (allocation) => allocation.vehicleId === vehicleId && allocation.date >= today,
  );
}

/** Upcoming allocations that fall on a new one-time or recurring off-day. */
export function getAllocationsBlockedByOffDay(
  vehicleId: string,
  offDay: { type: OffDayType; date?: string; weekday?: Weekday },
  allocations: Allocation[],
  today: string = todayString(),
): Allocation[] {
  const upcoming = getUpcomingAllocationsForVehicle(vehicleId, allocations, today);

  if (offDay.type === "One-time") {
    return upcoming.filter((allocation) => allocation.date === offDay.date);
  }

  return upcoming.filter((allocation) => getWeekdayFromDate(allocation.date) === offDay.weekday);
}

/**
 * Upcoming allocations that start before the vehicle is free of student
 * transport on that weekday.
 */
export function getAllocationsBlockedByStudentTransport(
  vehicleId: string,
  schedule: StudentTransportSchedule,
  allocations: Allocation[],
  today: string = todayString(),
): Allocation[] {
  return getUpcomingAllocationsForVehicle(vehicleId, allocations, today).filter((allocation) => {
    const freeAfter = schedule[getWeekdayFromDate(allocation.date)];
    return Boolean(freeAfter) && toMinutes(allocation.startTime) < toMinutes(freeAfter as string);
  });
}

/** Upcoming allocations that a vehicle taken out of service would strand. */
export function getAllocationsBlockedByUnavailability(
  vehicleId: string,
  allocations: Allocation[],
  today: string = todayString(),
): Allocation[] {
  return getUpcomingAllocationsForVehicle(vehicleId, allocations, today);
}

/** "2026-03-10 09:00–11:00, 2026-03-11 14:00–16:00" */
export function describeAllocations(allocations: Allocation[]): string {
  return [...allocations]
    .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))
    .map((allocation) => `${allocation.date} ${allocation.startTime}–${allocation.endTime}`)
    .join(", ");
}
