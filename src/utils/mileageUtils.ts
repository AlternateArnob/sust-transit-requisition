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
