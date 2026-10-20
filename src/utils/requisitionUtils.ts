import type { Requisition, Trip, ApplicationStatus } from "../types";

/**
 * Recomputes a requisition's status from its trips whenever a trip
 * decision changes. Phase 1 change: this used to default to a status
 * derived from `requisitionType` any time no trip had been decided yet.
 * That doesn't work anymore now that "no trip decided" can legitimately
 * mean either "Recommended", "Pending on Transport Office", or "Pending
 * Administrator" depending on where in the two-stage workflow the
 * requisition currently sits — so instead it falls back to whatever
 * status the requisition already has, and only moves it once trips are
 * actually decided.
 */
export function computeApplicationStatus(
  trips: Trip[],
  currentStatus: ApplicationStatus,
): ApplicationStatus {
  if (trips.length === 0) {
    return currentStatus;
  }

  const allApproved = trips.every((trip) => trip.status === "Approved");
  const allRejected = trips.every((trip) => trip.status === "Rejected");
  const anyDecided = trips.some((trip) => trip.status !== "Pending");

  if (allApproved) {
    return "Approved";
  }

  if (allRejected) {
    return "Rejected";
  }

  if (anyDecided) {
    return "Partially Approved";
  }

  return currentStatus;
}

/** Requisitions waiting on the Transport In Charge to assign a vehicle
 *  and forward them on (FRD §9). Covers both the freshly-recommended
 *  state and the (rare) case a Transport Administrator sent one back. */
export function isInTransportInChargeQueue(requisition: Requisition): boolean {
  return (
    requisition.status === "Recommended" ||
    requisition.status === "Pending on Transport Office"
  );
}

/** Requisitions waiting on the Transport Administrator's per-trip
 *  approve/reject decision (FRD §19). "Partially Approved" stays here
 *  too so remaining Pending trips on an already-partly-decided
 *  application are still reachable. */
export function isInTransportAdministratorQueue(
  requisition: Requisition,
): boolean {
  return (
    requisition.status === "Pending Administrator" ||
    requisition.status === "Partially Approved"
  );
}

export function isInActiveQueue(requisition: Requisition): boolean {
  return (
    isInTransportInChargeQueue(requisition) ||
    isInTransportAdministratorQueue(requisition)
  );
}

export function getTripStatusCounts(trips: Trip[]) {
  return {
    approved: trips.filter((trip) => trip.status === "Approved").length,
    rejected: trips.filter((trip) => trip.status === "Rejected").length,
    pending: trips.filter((trip) => trip.status === "Pending").length,
  };
}

export function formatDateRange(startDate: string, endDate: string): string {
  return startDate === endDate ? startDate : `${startDate} → ${endDate}`;
}

/** Phase 4 (FRD §18) — a visible type badge per requisition, same pill
 *  visual language as the ApplicationStatus badges already used in
 *  RequisitionsPage/RequisitionDetail, so the queue reads as one
 *  consistent tagging system rather than two different UI patterns. */
export function requisitionTypeBadgeClass(type: Requisition["requisitionType"]) {
  if (type === "Personal") return "bg-[#CFFAFE] text-[#0E7490]";
  if (type === "Departmental/Official") return "bg-[#E0E7FF] text-[#4338CA]";
  return "bg-[#FCE7F3] text-[#BE185D]"; // Club
}
