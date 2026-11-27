import type { AllocationLike, OffDayLike, StudentTransportSchedule } from "../types/index.js";
import { getWeekdayFromDate, toMinutes } from "./schedule.js";

/**
 * Guards that stop a change to a vehicle from stranding trips already allocated to it (Part 1 §11.9).
 * Only today's and future allocations count: past trips are history and never block a vehicle.
 * `today` is passed in (`todayString(new Date())` in the service) so these stay pure and testable.
 */

export function getUpcomingAllocationsForVehicle<T extends AllocationLike>(
  vehicleId: string,
  allocations: T[],
  today: string,
): T[] {
  return allocations.filter(
    (allocation) => allocation.vehicleId === vehicleId && allocation.date >= today,
  );
}

/** Upcoming allocations that fall on a new one-time (date) or recurring (weekday) off-day. */
export function getAllocationsBlockedByOffDay<T extends AllocationLike>(
  vehicleId: string,
  offDay: Pick<OffDayLike, "type" | "date" | "weekday">,
  allocations: T[],
  today: string,
): T[] {
  const upcoming = getUpcomingAllocationsForVehicle(vehicleId, allocations, today);
  if (offDay.type === "One-time") {
    return upcoming.filter((allocation) => allocation.date === offDay.date);
  }
  return upcoming.filter((allocation) => getWeekdayFromDate(allocation.date) === offDay.weekday);
}

/** Upcoming allocations that start before the vehicle is free of student transport that weekday. */
export function getAllocationsBlockedByStudentTransport<T extends AllocationLike>(
  vehicleId: string,
  schedule: StudentTransportSchedule,
  allocations: T[],
  today: string,
): T[] {
  return getUpcomingAllocationsForVehicle(vehicleId, allocations, today).filter((allocation) => {
    const freeAfter = schedule[getWeekdayFromDate(allocation.date)];
    return Boolean(freeAfter) && toMinutes(allocation.startTime) < toMinutes(freeAfter as string);
  });
}

/** Upcoming allocations that taking the vehicle out of service (or unavailable) would strand. */
export function getAllocationsBlockedByUnavailability<T extends AllocationLike>(
  vehicleId: string,
  allocations: T[],
  today: string,
): T[] {
  return getUpcomingAllocationsForVehicle(vehicleId, allocations, today);
}

/** `details.allocations` of the 409 responses in Part 1 §11.9. */
export function toAllocationConflictDetails(allocations: AllocationLike[]) {
  return allocations.map((allocation) => ({
    allocationId: allocation.id,
    requisitionId: allocation.requisitionId,
    tripId: allocation.tripId,
    date: allocation.date,
    startTime: allocation.startTime,
    endTime: allocation.endTime,
  }));
}

/** "2026-03-10 09:00–11:00, 2026-03-11 14:00–16:00" */
export function describeAllocations(allocations: AllocationLike[]): string {
  return [...allocations]
    .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))
    .map((allocation) => `${allocation.date} ${allocation.startTime}–${allocation.endTime}`)
    .join(", ");
}
