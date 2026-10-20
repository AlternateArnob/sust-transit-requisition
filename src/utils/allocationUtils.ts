import type {
  Allocation,
  Requisition,
  Trip,
  Vehicle,
  VehicleOffDay,
  StudentTransportVehicle,
} from "../types";

/**
 * Phase 8, §3 — reassigning a trip's vehicle/driver used to overwrite
 * the existing `Allocation` record in place (same `id`, fields
 * mutated). That's fine today only because the two callers
 * (`RequisitionsPage.tsx`'s pre-approval "Change Vehicle", and
 * `ConflictsPage.tsx`'s conflict-resolution reassign) both act before a
 * confirmation slip, duty slip, or mileage entry could exist for that
 * trip — nothing historical is actually at stake yet. But FRD §25 wants
 * reassignments to create a new record referencing the old one rather
 * than mutate in place, and the in-place version would become a real
 * problem the moment a future feature reassigns an *already-approved*
 * trip (FRD §21 describes exactly that). Callers should
 * `removeAllocation(existing.id)` then `addAllocation(...)` the result
 * of this, rather than calling `updateAllocation` on the same id.
 */
export function reassignAllocation(
  existing: Allocation,
  vehicleId: string,
  driverId: string | undefined,
): Allocation {
  return {
    ...existing,
    id: crypto.randomUUID(),
    vehicleId,
    driverId,
    allocatedAt: new Date().toISOString(),
  };
}

import { isVehicleEligibleForRequisition } from "./vehicleUtils";
import {
  getOffDayForVehicleOnDate,
  getStudentTransportEntry,
  getStudentTransportTimeForDate,
  isVehicleFreeAtTime,
  formatTimeDisplay,
} from "./scheduleUtils";

export interface TripContext {
  requisition: Requisition;
  trip: Trip;
}

/**
 * Phase 1 — trips still needing a Transport In Charge vehicle pick
 * before the requisition can be forwarded to the Administrator.
 * Rejected trips don't need one (nothing to allocate), so they don't
 * block forwarding.
 */
export function getTripsMissingVehicleAssignment(
  requisition: Requisition,
  allocations: Allocation[],
): Trip[] {
  const allocatedTripIds = new Set(
    allocations
      .filter((allocation) => allocation.requisitionId === requisition.id)
      .map((allocation) => allocation.tripId),
  );

  return requisition.trips.filter(
    (trip) => trip.status !== "Rejected" && !allocatedTripIds.has(trip.id),
  );
}

/** FRD §9 — "A vehicle must be assigned before an application is
 *  forwarded to the Transport Administrator." Applied per trip, since
 *  each trip is its own allocation requirement. */
export function canForwardToAdministrator(
  requisition: Requisition,
  allocations: Allocation[],
): boolean {
  return (
    getTripsMissingVehicleAssignment(requisition, allocations).length === 0
  );
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function timeRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return (
    toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd)
  );
}

export interface VehicleEligibility {
  vehicle: Vehicle;
  eligible: boolean;
  blockers: string[];
  warnings: string[];
}

export function getVehicleEligibility(
  vehicle: Vehicle,
  trip: Trip,
  context: {
    allocations: Allocation[];
    offDays: VehicleOffDay[];
    routes: StudentTransportVehicle[];
    excludeAllocationId?: string;
  },
): VehicleEligibility {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!isVehicleEligibleForRequisition(vehicle)) {
    blockers.push(
      vehicle.operationalStatus !== "Active"
        ? `Vehicle is ${vehicle.operationalStatus}`
        : "Vehicle is not available for requisition",
    );
  }

  if (!vehicle.permanentDriverId) {
    blockers.push("No permanent driver assigned to this vehicle");
  }

  const offDay = getOffDayForVehicleOnDate(
    vehicle.id,
    trip.date,
    context.offDays,
  );

  if (offDay) {
    blockers.push(
      offDay.type === "One-time"
        ? "Vehicle marked off-day on this date"
        : `Vehicle has a recurring off-day (every ${offDay.weekday})`,
    );
  }

  const conflictingAllocation = context.allocations.find(
    (allocation) =>
      allocation.id !== context.excludeAllocationId &&
      allocation.vehicleId === vehicle.id &&
      allocation.date === trip.date &&
      timeRangesOverlap(
        allocation.startTime,
        allocation.endTime,
        trip.startTime,
        trip.endTime,
      ),
  );

  if (conflictingAllocation) {
    blockers.push("Already allocated to another trip at an overlapping time");
  }

  if (trip.vehicleCategory !== "Any" && vehicle.category !== trip.vehicleCategory) {
    warnings.push(
      `Category mismatch — requisition asked for ${trip.vehicleCategory}`,
    );
  }

  const studentTransportTime = getStudentTransportTimeForDate(
    vehicle.id,
    trip.date,
    context.routes,
  );

  if (
    studentTransportTime &&
    !isVehicleFreeAtTime(vehicle.id, trip.date, trip.startTime, context.routes)
  ) {
    blockers.push(
      `Used for student transport on ${trip.date} until ${formatTimeDisplay(
        studentTransportTime,
      )} — not free yet`,
    );
  }

  return {
    vehicle,
    eligible: blockers.length === 0,
    blockers,
    warnings,
  };
}
