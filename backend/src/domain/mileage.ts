import type {
  AllocationLike,
  MileageEntryLike,
  RequisitionLike,
  TripLike,
} from "../types/index.js";

/**
 * Part 1 §11.8: only Personal requisitions by a Teacher or Officer are mileage-eligible.
 * Students and non-personal requisitions are not.
 */
export function isMileageEligibleRequisition(
  requisition: Pick<RequisitionLike, "requisitionType" | "applicantProfile">,
): boolean {
  return (
    requisition.requisitionType === "Personal" &&
    (requisition.applicantProfile === "Teacher" || requisition.applicantProfile === "Officer")
  );
}

/** Completed trips of the requisition that have an allocation and no mileage entry yet. */
export function getTripsAwaitingMileage(
  requisition: Pick<RequisitionLike, "id" | "trips">,
  allocations: Pick<AllocationLike, "tripId">[],
  entries: MileageEntryLike[],
): TripLike[] {
  const recordedTripIds = new Set(
    entries.filter((entry) => entry.requisitionId === requisition.id).map((entry) => entry.tripId),
  );
  const allocatedTripIds = new Set(allocations.map((allocation) => allocation.tripId));
  return requisition.trips.filter(
    (trip) =>
      trip.status === "Completed" && !recordedTripIds.has(trip.id) && allocatedTripIds.has(trip.id),
  );
}

export type MileageColumnStatus =
  | { kind: "not-applicable" }
  | { kind: "not-ready" }
  | { kind: "awaiting"; trips: TripLike[] }
  | { kind: "recorded"; distanceKm: number };

/** The applicant's "My Mileage" status for one requisition. */
export function getMileageColumnStatus(
  requisition: RequisitionLike,
  allocations: Pick<AllocationLike, "tripId">[],
  entries: MileageEntryLike[],
): MileageColumnStatus {
  if (!isMileageEligibleRequisition(requisition)) return { kind: "not-applicable" };

  const completedTrips = requisition.trips.filter((trip) => trip.status === "Completed");
  if (completedTrips.length === 0) return { kind: "not-ready" };

  const requisitionEntries = entries.filter((entry) => entry.requisitionId === requisition.id);
  const recordedTripIds = new Set(requisitionEntries.map((entry) => entry.tripId));

  if (completedTrips.every((trip) => recordedTripIds.has(trip.id))) {
    const totalKm = requisitionEntries.reduce((sum, entry) => sum + entry.distanceKm, 0);
    return { kind: "recorded", distanceKm: totalKm };
  }

  const awaiting = getTripsAwaitingMileage(requisition, allocations, entries);
  // A Completed trip without an allocation should be impossible; fail safe instead of guessing.
  return awaiting.length === 0 ? { kind: "not-ready" } : { kind: "awaiting", trips: awaiting };
}
