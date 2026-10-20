import type { Trip } from "./trip";
import type { ApplicantProfile } from "./user";

export type RequisitionType = "Personal" | "Departmental/Official" | "Club";

export const REQUISITION_TYPES: RequisitionType[] = [
  "Personal",
  "Departmental/Official",
  "Club",
];

/**
 * Phase 1 (admin module) — the flat "Pending Approval" stage is now two
 * explicit stages matching FRD §7/§9/§19: a requisition sits with the
 * Transport In Charge until a vehicle is assigned to every trip and it's
 * forwarded, then with the Transport Administrator for the actual
 * approve/reject decision. "Final Approved" is retired — the FRD has no
 * separate sign-off step beyond the Administrator's per-trip decisions,
 * so "Approved"/"Partially Approved" are now themselves the terminal,
 * confirmation-slip-eligible states.
 */
/**
 * Phase 6 (admin module) — "Completed" added for FRD §7/§22: once every
 * trip on a requisition is either Completed or Rejected (i.e. nothing
 * left in Approved/Pending), the requisition itself is done. Mileage-
 * eligible requisitions have a further, more specific terminal state —
 * "Ready for Accounts" — that supersedes this once mileage is recorded;
 * see completeTrip() in useRequisitions.ts.
 */
export type ApplicationStatus =
  | "Draft"
  | "Pending Recommendation"
  | "Information Requested"
  | "Recommended"
  | "Pending on Transport Office"
  | "Pending Administrator"
  | "Partially Approved"
  | "Approved"
  | "Completed"
  | "Ready for Accounts"
  | "Rejected";

/**
 * Phase 6 — "Completed" added for FRD §22: Transport Office marks a trip
 * Completed once it's actually happened, independently of mileage (FRD
 * is explicit that "completion status and mileage shall be stored
 * separately"). Only reachable from "Approved" — see completeTrip().
 */
export type TripStatus = "Pending" | "Approved" | "Rejected" | "Completed";

export type ScheduleType = "Single" | "Recurring";

export type RejectionReason =
  | "Vehicle unavailable"
  | "Driver unavailable"
  | "Schedule conflict"
  | "Other";

export const REJECTION_REASONS: RejectionReason[] = [
  "Vehicle unavailable",
  "Driver unavailable",
  "Schedule conflict",
  "Other",
];

export interface Requisition {
  id: string;
  requesterId: string;
  requesterName: string;
  department?: string;
  contactNumber?: string;
  requisitionType: RequisitionType;
  /**
   * Phase 6 (admin module) — captured from the requester's account at
   * submission time (RequisitionForm.tsx), not editable afterward.
   * Needed because FRD §23 scopes mileage tracking narrower than
   * `requisitionType === "Personal"` alone can express — see
   * utils/mileageUtils.ts `isMileageEligibleRequisition()`. Optional
   * because it isn't meaningful for Club/Society accounts (no
   * Teacher/Student/Officer profile) and because pre-Phase-6 stored
   * requisitions won't have it.
   */
  applicantProfile?: ApplicantProfile;
  purpose: string;
  startDate: string;
  endDate: string;
  scheduleType: ScheduleType;
  status: ApplicationStatus;
  recommenderName?: string;
  /**
   * Phase 1 — set when the Transport Administrator sends the whole
   * application back to the Transport In Charge for rework (e.g. the
   * assigned vehicle turned out to be unsuitable). Cleared the next time
   * it's forwarded again so a stale reason doesn't linger after it's
   * been addressed.
   */
  transportOfficeRemarks?: string;
  /**
   * Step 6 (applicant module) — the optional file uploaded in Step 4 of
   * the application form (FRD §5.1 "Supporting document, where
   * applicable"). Stored as a data URL alongside the requisition, same
   * pattern as `signatureDataUrl` on UserAccount, so it can persist in
   * localStorage without a separate file-storage layer. Only visible to
   * Transport Office staff reviewing the application — it is not part
   * of the confirmation slip (FRD §20's field list doesn't include it).
   */
  supportingDocumentName?: string;
  supportingDocumentDataUrl?: string;
  createdAt: string;
  trips: Trip[];
}
