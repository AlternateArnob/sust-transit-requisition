import type { AllocationLike, DutySlipLike, RequisitionLike, TripLike } from "../types/index.js";

export interface DriverTripGroup<
  T extends TripLike = TripLike,
  A extends AllocationLike = AllocationLike,
> {
  driverId: string;
  trips: { trip: T; allocation: A }[];
}

/**
 * Trips a *new* duty slip can be generated for: only `Approved` trips (a Completed trip has nothing
 * left to instruct; historical slips stay visible) that have an allocation with a driver, grouped
 * by driver and sorted by date then start time.
 */
export function getEligibleDutySlipGroups<T extends TripLike, A extends AllocationLike>(
  requisition: Pick<RequisitionLike, "id"> & { trips: T[] },
  allocations: A[],
): DriverTripGroup<T, A>[] {
  const groups = new Map<string, { trip: T; allocation: A }[]>();

  for (const trip of requisition.trips) {
    if (trip.status !== "Approved") continue;
    const allocation = allocations.find((item) => item.tripId === trip.id);
    if (!allocation || !allocation.driverId) continue;

    const entries = groups.get(allocation.driverId) ?? [];
    entries.push({ trip, allocation });
    groups.set(allocation.driverId, entries);
  }

  return Array.from(groups.entries()).map(([driverId, trips]) => ({
    driverId,
    trips: trips.sort((a, b) =>
      `${a.trip.date} ${a.trip.startTime}`.localeCompare(`${b.trip.date} ${b.trip.startTime}`),
    ),
  }));
}

/**
 * True when the slip no longer matches reality: a trip it lists has lost its allocation or now has
 * a different vehicle. It flags the current slip only; it never decides which slip is superseded.
 */
export function isDutySlipStale(
  slip: DutySlipLike,
  allocations: Pick<AllocationLike, "tripId" | "vehicleId">[],
): boolean {
  return slip.trips.some((snapshot) => {
    const current = allocations.find((allocation) => allocation.tripId === snapshot.tripId);
    return !current || current.vehicleId !== snapshot.vehicleId;
  });
}
