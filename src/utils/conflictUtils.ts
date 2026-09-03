import type {
  Allocation,
  Requisition,
  Trip,
  Vehicle,
  VehicleOffDay,
  RecurringRoute,
} from "../types";
import { timeRangesOverlap } from "./allocationUtils";
import {
  getOffDayForVehicleOnDate,
  getRoutesForVehicleOnDate,
} from "./routeUtils";

export type ConflictType =
  | "Vehicle Double-Booked"
  | "Off-Day Conflict"
  | "Vehicle Unavailable"
  | "Recurring Route Overlap";

export type ConflictSeverity = "Blocking" | "Warning";

export interface Conflict {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  vehicleId: string;
  allocation: Allocation;
  requisition: Requisition;
  trip: Trip;
  description: string;
}

export function detectConflicts(
  allocations: Allocation[],
  requisitions: Requisition[],
  vehicles: Vehicle[],
  offDays: VehicleOffDay[],
  routes: RecurringRoute[],
): Conflict[] {
  const conflicts: Conflict[] = [];

  function findContext(allocation: Allocation) {
    const requisition = requisitions.find(
      (item) => item.id === allocation.requisitionId,
    );
    const trip = requisition?.trips.find(
      (item) => item.id === allocation.tripId,
    );

    return requisition && trip ? { requisition, trip } : undefined;
  }

  allocations.forEach((allocation) => {
    const context = findContext(allocation);

    if (!context) {
      return;
    }

    const { requisition, trip } = context;
    const vehicle = vehicles.find((item) => item.id === allocation.vehicleId);

    if (!vehicle) {
      return;
    }

    if (
      vehicle.operationalStatus !== "Active" ||
      !vehicle.availableForRequisition
    ) {
      conflicts.push({
        id: `unavailable-${allocation.id}`,
        type: "Vehicle Unavailable",
        severity: "Blocking",
        vehicleId: vehicle.id,
        allocation,
        requisition,
        trip,
        description: `${vehicle.registrationNumber} is ${
          vehicle.operationalStatus !== "Active"
            ? vehicle.operationalStatus
            : "no longer available for requisition"
        } but is still allocated to this trip.`,
      });
    }

    const offDay = getOffDayForVehicleOnDate(
      vehicle.id,
      allocation.date,
      offDays,
    );

    if (offDay) {
      conflicts.push({
        id: `offday-${allocation.id}`,
        type: "Off-Day Conflict",
        severity: "Blocking",
        vehicleId: vehicle.id,
        allocation,
        requisition,
        trip,
        description: `${vehicle.registrationNumber} is marked off-day on ${
          allocation.date
        } (${
          offDay.type === "One-time"
            ? "one-time"
            : `recurring, every ${offDay.weekday}`
        }) but is still allocated to this trip.`,
      });
    }

    allocations.forEach((other) => {
      if (
        other.id !== allocation.id &&
        other.vehicleId === allocation.vehicleId &&
        other.date === allocation.date &&
        allocation.id < other.id &&
        timeRangesOverlap(
          allocation.startTime,
          allocation.endTime,
          other.startTime,
          other.endTime,
        )
      ) {
        conflicts.push({
          id: `double-${allocation.id}-${other.id}`,
          type: "Vehicle Double-Booked",
          severity: "Blocking",
          vehicleId: vehicle.id,
          allocation,
          requisition,
          trip,
          description: `${vehicle.registrationNumber} is allocated to two overlapping trips on ${allocation.date} (${allocation.startTime}–${allocation.endTime} and ${other.startTime}–${other.endTime}).`,
        });
      }
    });

    const scheduledRoutes = getRoutesForVehicleOnDate(
      vehicle.id,
      allocation.date,
      routes,
    );

    if (scheduledRoutes.length > 0) {
      conflicts.push({
        id: `route-${allocation.id}`,
        type: "Recurring Route Overlap",
        severity: "Warning",
        vehicleId: vehicle.id,
        allocation,
        requisition,
        trip,
        description: `${vehicle.registrationNumber} has ${scheduledRoutes.length} recurring route trip(s) scheduled on this weekday — verify no timing clash.`,
      });
    }
  });

  return conflicts;
}
