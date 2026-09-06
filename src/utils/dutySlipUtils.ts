import type { Requisition, Trip, Allocation, DutySlip } from "../types";

export interface DriverTripGroup {
  driverId: string;
  trips: { trip: Trip; allocation: Allocation }[];
}

/**
 * Phase 6, §3.4 audit — deliberately left at `trip.status === "Approved"`
 * only, NOT extended to "Completed". A duty slip is the driver's
 * pre-trip instructions; once a trip is Completed there's nothing left
 * to instruct, so it shouldn't offer a fresh "Generate Duty Slip" for
 * it. Historical slips already generated for a now-Completed trip
 * remain fully visible via getDutySlipHistory below — this only governs
 * whether a *new* one can be generated.
 */
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

/**
 * Phase 5, §2.2 decision A — every slip ever generated for this
 * driver+requisition, newest first. The [0] entry is the current one;
 * everything after it is superseded by definition (a newer slip exists),
 * regardless of *why* it was regenerated — adding a day counts the same
 * as a vehicle swap. This is what makes FR-21's "the previous duty slip
 * shall be marked Superseded — see new slip" literally true instead of
 * only true for the vehicle-reassignment case.
 */
export function getDutySlipHistory(
  requisitionId: string,
  driverId: string,
  dutySlips: DutySlip[],
): DutySlip[] {
  return [...dutySlips]
    .filter(
      (slip) =>
        slip.requisitionId === requisitionId && slip.driverId === driverId,
    )
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
}

export function getLatestSlipForDriver(
  requisitionId: string,
  driverId: string,
  dutySlips: DutySlip[],
): DutySlip | undefined {
  return getDutySlipHistory(requisitionId, driverId, dutySlips)[0];
}

/** True for every slip except the newest one for its driver+requisition. */
export function isDutySlipSuperseded(
  slip: DutySlip,
  requisitionId: string,
  dutySlips: DutySlip[],
): boolean {
  const latest = getLatestSlipForDriver(
    requisitionId,
    slip.driverId,
    dutySlips,
  );
  return latest ? latest.id !== slip.id : false;
}

/**
 * Additive to the §2.2 decision, not a substitute for it: even under
 * "any regeneration supersedes," nothing prompts a regeneration by
 * itself. If a vehicle gets reassigned after the *current* slip was
 * printed and nobody has regenerated yet, the current slip is still
 * technically "Active" per isDutySlipSuperseded (nothing newer exists)
 * but its printed vehicle/registration no longer matches reality — the
 * exact scenario FR-21 opens with. This flags that gap on the current
 * slip only; it never affects which slip counts as "Superseded."
 */
export function hasStaleVehicleAssignment(
  slip: DutySlip,
  allocations: Allocation[],
): boolean {
  return slip.trips.some((snapshot) => {
    const current = allocations.find(
      (item) => item.tripId === snapshot.tripId,
    );
    return !current || current.vehicleId !== snapshot.vehicleId;
  });
}

/**
 * Phase 5, §2.1 — shared by the Documents-section UI (to decide whether
 * to show the button) and the handler that actually generates the PDF
 * (so the guarantee holds even if a future UI change stops hiding the
 * button correctly). Single source of truth instead of two copies that
 * can drift.
 *
 * Phase 6, §3.4 audit — added "Completed" here. Once every trip is done,
 * the requisition's slips should still be viewable/downloadable (FRD
 * §25 — historical records don't disappear), not locked out just
 * because nothing is left "Approved" anymore.
 */
export function canGenerateSlips(requisition: Requisition): boolean {
  return (
    requisition.status === "Approved" ||
    requisition.status === "Partially Approved" ||
    requisition.status === "Completed" ||
    requisition.status === "Ready for Accounts"
  );
}
