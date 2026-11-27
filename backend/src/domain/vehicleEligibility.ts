import type {
  AllocationLike,
  OffDayLike,
  RequisitionLike,
  StudentTransportEntryLike,
  TripLike,
  VehicleLike,
} from "../types/index.js";
import {
  formatTimeDisplay,
  getOffDayForVehicleOnDate,
  getStudentTransportTimeForDate,
  isVehicleFreeAtTime,
  toMinutes,
} from "./schedule.js";

/** Strict overlap: back-to-back ranges (09:00-11:00 and 11:00-13:00) do not overlap. */
export function timeRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd);
}

export interface EligibilityContext {
  /** Allocations of every vehicle (only this vehicle's are looked at). */
  allocations: AllocationLike[];
  offDays: OffDayLike[];
  studentTransport: StudentTransportEntryLike[];
  /** When reassigning, the trip's own current allocation must not block itself. */
  excludeAllocationId?: string;
}

export interface VehicleEligibility {
  eligible: boolean;
  blockers: string[];
  warnings: string[];
}

/** Part 1 §11.6: five blockers (any one makes the vehicle ineligible) and one warning. */
export function getVehicleEligibility(
  vehicle: VehicleLike,
  trip: Pick<TripLike, "date" | "startTime" | "endTime" | "vehicleCategory">,
  context: EligibilityContext,
): VehicleEligibility {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // 1. Operational status and availability flag.
  if (vehicle.operationalStatus !== "Active") {
    blockers.push(`Vehicle is ${vehicle.operationalStatus}`);
  } else if (!vehicle.availableForRequisition) {
    blockers.push("Vehicle is not available for requisition");
  }

  // 2. A permanent driver is required (the allocation's driver defaults to it).
  if (!vehicle.permanentDriverId) {
    blockers.push("No permanent driver assigned to this vehicle");
  }

  // 3. Off-day on the trip date (one-time date or recurring weekday).
  const offDay = getOffDayForVehicleOnDate(vehicle.id, trip.date, context.offDays);
  if (offDay) {
    blockers.push(
      offDay.type === "One-time"
        ? "Vehicle marked off-day on this date"
        : `Vehicle has a recurring off-day (every ${offDay.weekday})`,
    );
  }

  // 4. Overlapping allocation of the same vehicle on the same date.
  const clash = context.allocations.find(
    (allocation) =>
      allocation.id !== context.excludeAllocationId &&
      allocation.vehicleId === vehicle.id &&
      allocation.date === trip.date &&
      timeRangesOverlap(allocation.startTime, allocation.endTime, trip.startTime, trip.endTime),
  );
  if (clash) {
    blockers.push("Already allocated to another trip at an overlapping time");
  }

  // 5. Student-transport schedule: the trip must start at or after the "free after" time.
  const freeAfter = getStudentTransportTimeForDate(vehicle.id, trip.date, context.studentTransport);
  if (
    freeAfter &&
    !isVehicleFreeAtTime(vehicle.id, trip.date, trip.startTime, context.studentTransport)
  ) {
    blockers.push(
      `Used for student transport on ${trip.date} until ${formatTimeDisplay(freeAfter)} — not free yet`,
    );
  }

  // Warning only: the trip asked for a specific category and this vehicle is another one.
  if (trip.vehicleCategory !== "Any" && vehicle.category !== trip.vehicleCategory) {
    warnings.push(`Category mismatch — requisition asked for ${trip.vehicleCategory}`);
  }

  return { eligible: blockers.length === 0, blockers, warnings };
}

/** Trips that still need a vehicle before forwarding. Rejected trips need none. */
export function getTripsMissingVehicleAssignment<T extends Pick<TripLike, "id" | "status">>(
  requisition: Pick<RequisitionLike, "id"> & { trips: T[] },
  allocations: Pick<AllocationLike, "requisitionId" | "tripId">[],
): T[] {
  const allocatedTripIds = new Set(
    allocations
      .filter((allocation) => allocation.requisitionId === requisition.id)
      .map((allocation) => allocation.tripId),
  );
  return requisition.trips.filter(
    (trip) => trip.status !== "Rejected" && !allocatedTripIds.has(trip.id),
  );
}

/** Part 1 §11.6: every non-rejected trip must have an allocation before forwarding. */
export function canForwardToAdministrator(
  requisition: Pick<RequisitionLike, "id" | "trips">,
  allocations: Pick<AllocationLike, "requisitionId" | "tripId">[],
): boolean {
  return getTripsMissingVehicleAssignment(requisition, allocations).length === 0;
}

/** A vehicle can take requisitions only while it is Active and its availability flag is on. */
export function isVehicleEligibleForRequisition(
  vehicle: Pick<VehicleLike, "operationalStatus" | "availableForRequisition">,
): boolean {
  return vehicle.operationalStatus === "Active" && vehicle.availableForRequisition;
}

/** True when a change moves a vehicle from "can take requisitions" to "cannot" (Part 1 §11.9). */
export function becomesUnavailable(
  before: Pick<VehicleLike, "operationalStatus" | "availableForRequisition">,
  after: Pick<VehicleLike, "operationalStatus" | "availableForRequisition">,
): boolean {
  return isVehicleEligibleForRequisition(before) && !isVehicleEligibleForRequisition(after);
}
