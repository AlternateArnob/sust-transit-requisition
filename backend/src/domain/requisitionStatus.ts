import type { ApplicationStatus } from "../config/constants.js";
import { invalidState } from "../errors/AppError.js";
import type { RequisitionLike, TripLike } from "../types/index.js";

/**
 * Recomputes a requisition's status from its trips after a trip is approved, rejected or reset
 * (Part 1 §11.5). With no decision yet it keeps the current status.
 *
 * `Completed` trips count as approved: a trip can be completed while a sibling is still Pending,
 * and deciding that sibling afterwards must not demote the requisition. If every trip is already
 * Completed the completion rules own the status, so the current one is kept.
 */
export function computeApplicationStatus(
  trips: Pick<TripLike, "status">[],
  currentStatus: ApplicationStatus,
): ApplicationStatus {
  if (trips.length === 0) return currentStatus;

  const allCompleted = trips.every((trip) => trip.status === "Completed");
  const allApproved = trips.every(
    (trip) => trip.status === "Approved" || trip.status === "Completed",
  );
  const allRejected = trips.every((trip) => trip.status === "Rejected");
  const anyDecided = trips.some((trip) => trip.status !== "Pending");

  if (allCompleted) return currentStatus;
  if (allApproved) return "Approved";
  if (allRejected) return "Rejected";
  if (anyDecided) return "Partially Approved";
  return currentStatus;
}

/**
 * Part 1 §11.7: after a trip is marked Completed, the requisition becomes `Completed` once no trip
 * is left Approved or Pending. Never regresses from `Ready for Accounts`.
 */
export function computeStatusAfterTripCompletion(
  trips: Pick<TripLike, "status">[],
  currentStatus: ApplicationStatus,
): ApplicationStatus {
  if (currentStatus === "Ready for Accounts") return currentStatus;
  const settled = trips.every((trip) => trip.status !== "Approved" && trip.status !== "Pending");
  return trips.length > 0 && settled ? "Completed" : currentStatus;
}

/** Waiting on the Transport In-Charge to assign vehicles and forward (or send back). */
export function isInTransportInChargeQueue(requisition: Pick<RequisitionLike, "status">): boolean {
  return (
    requisition.status === "Recommended" || requisition.status === "Pending on Transport Office"
  );
}

/**
 * Waiting on the Transport Administrator. Stricter than the frontend (Part 1 §11.5): a
 * `Partially Approved` requisition is only in the queue while at least one trip is still Pending,
 * so a finished mixed approve/reject requisition leaves it.
 */
export function isInTransportAdministratorQueue(
  requisition: Pick<RequisitionLike, "status" | "trips">,
): boolean {
  if (requisition.status === "Pending Administrator") return true;
  return (
    requisition.status === "Partially Approved" &&
    requisition.trips.some((trip) => trip.status === "Pending")
  );
}

export function isInActiveQueue(requisition: Pick<RequisitionLike, "status" | "trips">): boolean {
  return isInTransportInChargeQueue(requisition) || isInTransportAdministratorQueue(requisition);
}

/** Slips can be viewed/generated once the requisition is approved, and stay available afterwards. */
export function canGenerateSlips(requisition: Pick<RequisitionLike, "status">): boolean {
  return (
    requisition.status === "Approved" ||
    requisition.status === "Partially Approved" ||
    requisition.status === "Completed" ||
    requisition.status === "Ready for Accounts"
  );
}

// ---------------------------------------------------------------------------------------------
// Allowed transitions (Part 1 §11.2). The services enforce exactly these; anything else is a
// 409 INVALID_STATE. "Create draft" has no from-status and is not listed.
// ---------------------------------------------------------------------------------------------

export const TRANSITIONS = {
  edit_draft: ["Draft"],
  submit: ["Draft"],
  recommend: ["Pending Recommendation"],
  reject_by_head: ["Pending Recommendation"],
  send_back_by_head: ["Pending Recommendation"],
  send_back_by_in_charge: ["Recommended", "Pending on Transport Office"],
  resubmit: ["Information Requested"],
  forward: ["Recommended", "Pending on Transport Office"],
  assign_vehicle: ["Recommended", "Pending on Transport Office"],
  decide_trip: ["Pending Administrator", "Partially Approved"],
  send_back_to_in_charge: ["Pending Administrator", "Partially Approved"],
  complete_trip: ["Approved", "Partially Approved", "Completed"],
  record_mileage: ["Approved", "Partially Approved", "Completed"],
} as const satisfies Record<string, readonly ApplicationStatus[]>;

export type RequisitionAction = keyof typeof TRANSITIONS;

const ACTION_LABELS: Record<RequisitionAction, string> = {
  edit_draft: "edit",
  submit: "submit",
  recommend: "recommend",
  reject_by_head: "reject",
  send_back_by_head: "send back",
  send_back_by_in_charge: "send back",
  resubmit: "resubmit",
  forward: "forward",
  assign_vehicle: "assign a vehicle to",
  decide_trip: "decide trips of",
  send_back_to_in_charge: "send back to the Transport In-Charge",
  complete_trip: "complete a trip of",
  record_mileage: "record mileage for",
};

export function canTransition(action: RequisitionAction, fromStatus: ApplicationStatus): boolean {
  return (TRANSITIONS[action] as readonly ApplicationStatus[]).includes(fromStatus);
}

/** Throws `AppError 409 INVALID_STATE` unless `action` is allowed from `fromStatus`. */
export function assertTransition(action: RequisitionAction, fromStatus: ApplicationStatus): void {
  if (!canTransition(action, fromStatus)) {
    throw invalidState(`Cannot ${ACTION_LABELS[action]} a requisition that is "${fromStatus}"`);
  }
}
