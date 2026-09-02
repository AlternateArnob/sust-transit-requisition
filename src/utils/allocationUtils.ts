import type {
  Allocation,
  Requisition,
  Trip,
  Vehicle,
  VehicleOffDay,
  RecurringRoute,
} from "../types";
import { isVehicleEligibleForRequisition } from "./vehicleUtils";
import {
  getOffDayForVehicleOnDate,
  getRoutesForVehicleOnDate,
} from "./routeUtils";

export interface TripContext {
  requisition: Requisition;
  trip: Trip;
}

export function getApprovedTripsNeedingAllocation(
  requisitions: Requisition[],
  allocations: Allocation[],
): TripContext[] {
  const allocatedTripIds = new Set(
    allocations.map((allocation) => allocation.tripId),
  );

  const result: TripContext[] = [];

  requisitions.forEach((requisition) => {
    requisition.trips.forEach((trip) => {
      if (trip.status === "Approved" && !allocatedTripIds.has(trip.id)) {
        result.push({ requisition, trip });
      }
    });
  });

  return result.sort((a, b) => a.trip.date.localeCompare(b.trip.date));
}

export function getAllocatedTrips(
  requisitions: Requisition[],
  allocations: Allocation[],
): (TripContext & { allocation: Allocation })[] {
  const result: (TripContext & { allocation: Allocation })[] = [];

  allocations.forEach((allocation) => {
    const requisition = requisitions.find(
      (item) => item.id === allocation.requisitionId,
    );
    const trip = requisition?.trips.find(
      (item) => item.id === allocation.tripId,
    );

    if (requisition && trip) {
      result.push({ requisition, trip, allocation });
    }
  });

  return result.sort((a, b) => a.trip.date.localeCompare(b.trip.date));
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
    routes: RecurringRoute[];
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

  if (vehicle.category !== trip.vehicleCategory) {
    warnings.push(
      `Category mismatch — requisition asked for ${trip.vehicleCategory}`,
    );
  }

  const scheduledRoutes = getRoutesForVehicleOnDate(
    vehicle.id,
    trip.date,
    context.routes,
  );

  if (scheduledRoutes.length > 0) {
    warnings.push(
      `Vehicle has ${scheduledRoutes.length} recurring route trip(s) on this weekday — verify timing`,
    );
  }

  return {
    vehicle,
    eligible: blockers.length === 0,
    blockers,
    warnings,
  };
}
