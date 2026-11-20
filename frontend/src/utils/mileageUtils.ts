import type { Requisition, Trip, Allocation, MileageEntry } from "../types";

export interface MileageTripContext {
  requisition: Requisition;
  trip: Trip;
  allocation: Allocation;
}

/**
 * Phase 6 (admin module) — FRD §23 opens with "For approved personal-use
 * Teacher requisitions..."; the Phase 6 plan's decision extends this to
 * Officer personal-use trips too. Student personal-use trips, though
 * allowed per §5.3, are NOT mileage-eligible. Renamed from
 * isPersonalUseRequisition since that name no longer matched what the
 * function actually gates — a Student's Personal-type requisition is
 * still "personal use" in the plain sense, just not mileage-eligible.
 */
export function isMileageEligibleRequisition(requisition: Requisition): boolean {
  return (
    requisition.requisitionType === "Personal" &&
    (requisition.applicantProfile === "Teacher" ||
      requisition.applicantProfile === "Officer")
  );
}

export function getTripsAwaitingMileage(
  requisitions: Requisition[],
  allocations: Allocation[],
  mileageEntries: MileageEntry[],
): MileageTripContext[] {
  const recordedTripIds = new Set(mileageEntries.map((entry) => entry.tripId));
  const result: MileageTripContext[] = [];

  requisitions.filter(isMileageEligibleRequisition).forEach((requisition) => {
    requisition.trips.forEach((trip) => {
      // Phase 6, §3.4 audit — was `!== "Approved"`. Mileage is recorded
      // "after the vehicle returns to the depot" (FRD §23), which is
      // downstream of the trip actually happening, not just being
      // approved. Requiring Completed keeps mileage entry from opening
      // up before Transport Office has confirmed the trip occurred.
      if (trip.status !== "Completed" || recordedTripIds.has(trip.id)) {
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
    // Phase 6, §3.4 audit — see getTripsAwaitingMileage for why this is
    // Completed rather than Approved.
    if (trip.status !== "Completed" || recordedTripIds.has(trip.id)) {
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
  if (!isMileageEligibleRequisition(requisition)) {
    return { kind: "not-applicable" };
  }

  // Phase 6, §3.4 audit — was "approvedTrips" gated on Approved. Mileage
  // now only makes sense once a trip is actually Completed (see
  // getTripsAwaitingMileage), so an Approved-but-not-yet-Completed trip
  // correctly reads as "not-ready" rather than jumping straight to
  // "awaiting".
  const completedTrips = requisition.trips.filter(
    (trip) => trip.status === "Completed",
  );

  if (completedTrips.length === 0) {
    return { kind: "not-ready" };
  }

  const requisitionEntries = mileageEntries.filter(
    (entry) => entry.requisitionId === requisition.id,
  );
  const recordedTripIds = new Set(
    requisitionEntries.map((entry) => entry.tripId),
  );

  // Every completed trip on this requisition has a recorded distance —
  // applicant can now see the total across all of them.
  const allCompletedTripsRecorded = completedTrips.every((trip) =>
    recordedTripIds.has(trip.id),
  );

  if (allCompletedTripsRecorded) {
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
    // Completed trip(s) exist but somehow have no allocation on record
    // (shouldn't happen — a trip can't reach Approved, let alone
    // Completed, without one — but fail safe rather than assume).
    return { kind: "not-ready" };
  }

  return { kind: "awaiting", trips: awaiting };
}
