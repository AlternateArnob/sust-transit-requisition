import type { Requisition, Trip, Allocation, DutySlip } from "../types";

export interface DriverTripGroup {
  driverId: string;
  trips: { trip: Trip; allocation: Allocation }[];
}

export function getEligibleDutySlipGroups(
  requisition: Requisition,
  allocations: Allocation[],
): DriverTripGroup[] {
  const groups = new Map<string, { trip: Trip; allocation: Allocation }[]>();

  requisition.trips.forEach((trip) => {
    if (trip.status !== "Approved") {
      return;
    }

    const allocation = allocations.find((item) => item.tripId === trip.id);

    if (!allocation || !allocation.driverId) {
      return;
    }

    const existing = groups.get(allocation.driverId) ?? [];
    existing.push({ trip, allocation });
    groups.set(allocation.driverId, existing);
  });

  return Array.from(groups.entries()).map(([driverId, trips]) => ({
    driverId,
    trips: trips.sort((a, b) => a.trip.date.localeCompare(b.trip.date)),
  }));
}

export function getLatestSlipForDriver(
  requisitionId: string,
  driverId: string,
  dutySlips: DutySlip[],
): DutySlip | undefined {
  return [...dutySlips]
    .filter(
      (slip) =>
        slip.requisitionId === requisitionId && slip.driverId === driverId,
    )
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))[0];
}

export function isDutySlipSuperseded(
  slip: DutySlip,
  allocations: Allocation[],
): boolean {
  return slip.trips.some((snapshot) => {
    const current = allocations.find((item) => item.tripId === snapshot.tripId);
    return !current || current.vehicleId !== snapshot.vehicleId;
  });
}
