import type { Requisition, Trip, Allocation, MileageEntry } from "../types";

export interface MileageTripContext {
  requisition: Requisition;
  trip: Trip;
  allocation: Allocation;
}

export function isPersonalUseRequisition(requisition: Requisition): boolean {
  return requisition.requisitionType === "Personal";
}

export function getTripsAwaitingMileage(
  requisitions: Requisition[],
  allocations: Allocation[],
  mileageEntries: MileageEntry[],
): MileageTripContext[] {
  const recordedTripIds = new Set(mileageEntries.map((entry) => entry.tripId));
  const result: MileageTripContext[] = [];

  requisitions.filter(isPersonalUseRequisition).forEach((requisition) => {
    requisition.trips.forEach((trip) => {
      if (trip.status !== "Approved" || recordedTripIds.has(trip.id)) {
        return;
      }

      const allocation = allocations.find((item) => item.tripId === trip.id);

      if (allocation) {
        result.push({ requisition, trip, allocation });
      }
    });
  });

  return result.sort((a, b) => a.trip.date.localeCompare(b.trip.date));
}

export function getRecordedMileageTrips(
  requisitions: Requisition[],
  allocations: Allocation[],
  mileageEntries: MileageEntry[],
): (MileageTripContext & { entry: MileageEntry })[] {
  const result: (MileageTripContext & { entry: MileageEntry })[] = [];

  mileageEntries.forEach((entry) => {
    const requisition = requisitions.find(
      (item) => item.id === entry.requisitionId,
    );
    const trip = requisition?.trips.find((item) => item.id === entry.tripId);
    const allocation = allocations.find((item) => item.tripId === entry.tripId);

    if (requisition && trip && allocation) {
      result.push({ requisition, trip, allocation, entry });
    }
  });

  return result.sort((a, b) =>
    b.entry.recordedAt.localeCompare(a.entry.recordedAt),
  );
}

export function getAwaitingMileageTripsForRequisition(
  requisition: Requisition,
  allocations: Allocation[],
  mileageEntries: MileageEntry[],
): MileageTripContext[] {
  const recordedTripIds = new Set(
    mileageEntries
      .filter((entry) => entry.requisitionId === requisition.id)
      .map((entry) => entry.tripId),
  );

  const result: MileageTripContext[] = [];

  requisition.trips.forEach((trip) => {
    if (trip.status !== "Approved" || recordedTripIds.has(trip.id)) {
      return;
    }

    const allocation = allocations.find((item) => item.tripId === trip.id);

    if (allocation) {
      result.push({ requisition, trip, allocation });
    }
  });

  return result;
}

export type MileageColumnStatus =
  | { kind: "not-applicable" }
  | { kind: "not-ready" }
  | { kind: "awaiting"; trips: MileageTripContext[] }
  | { kind: "recorded"; distanceKm: number };

export function getMileageColumnStatus(
  requisition: Requisition,
  allocations: Allocation[],
  mileageEntries: MileageEntry[],
): MileageColumnStatus {
  if (!isPersonalUseRequisition(requisition)) {
    return { kind: "not-applicable" };
  }

  const approvedTrips = requisition.trips.filter(
    (trip) => trip.status === "Approved",
  );

  if (approvedTrips.length === 0) {
    return { kind: "not-ready" };
  }

  const requisitionEntries = mileageEntries.filter(
    (entry) => entry.requisitionId === requisition.id,
  );
  const recordedTripIds = new Set(
    requisitionEntries.map((entry) => entry.tripId),
  );

  // Every approved trip on this requisition has a recorded distance —
  // Phase 7: applicant can now see the total across all of them.
  const allApprovedTripsRecorded = approvedTrips.every((trip) =>
    recordedTripIds.has(trip.id),
  );

  if (allApprovedTripsRecorded) {
    const totalKm = requisitionEntries.reduce(
      (sum, entry) => sum + entry.distanceKm,
      0,
    );
    return { kind: "recorded", distanceKm: totalKm };
  }

  const awaiting = getAwaitingMileageTripsForRequisition(
    requisition,
    allocations,
    mileageEntries,
  );

  if (awaiting.length === 0) {
    // Approved trip(s) exist but none has a vehicle allocated yet.
    return { kind: "not-ready" };
  }

  return { kind: "awaiting", trips: awaiting };
}
