import { useEffect, useState } from "react";
import type {
  Requisition,
  RejectionReason,
  Trip,
} from "../types";
import { computeApplicationStatus } from "../utils/requisitionUtils";

const STORAGE_KEY = "sust-transit-requisitions";

/**
 * Trimmed remarks so empty strings collapse to `undefined` — keeps the
 * persisted shape tidy and avoids " " sneaking into lists.
 */
function trimRemarks(remarks?: string): string | undefined {
  const trimmed = remarks?.trim();
  return trimmed ? trimmed : undefined;
}

export default function useRequisitions() {
  const [requisitions, setRequisitions] = useState<Requisition[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return [];
    }

    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requisitions));
  }, [requisitions]);

  function addRequisition(requisition: Requisition) {
    setRequisitions((current) => [...current, requisition]);
  }

  function deleteRequisition(requisitionId: string) {
    setRequisitions((current) =>
      current.filter((requisition) => requisition.id !== requisitionId),
    );
  }

  function approveTrip(requisitionId: string, tripId: string) {
    setRequisitions((current) =>
      current.map((requisition) => {
        if (requisition.id !== requisitionId) {
          return requisition;
        }

        const trips = requisition.trips.map((trip) =>
          trip.id === tripId
            ? {
                ...trip,
                status: "Approved" as const,
                rejectionReason: undefined,
                rejectionRemarks: undefined,
              }
            : trip,
        );

        return {
          ...requisition,
          trips,
          status: computeApplicationStatus(trips, requisition.requisitionType),
        };
      }),
    );
  }

  function rejectTrip(
    requisitionId: string,
    tripId: string,
    reason: RejectionReason,
    remarks?: string,
  ) {
    setRequisitions((current) =>
      current.map((requisition) => {
        if (requisition.id !== requisitionId) {
          return requisition;
        }

        const trips = requisition.trips.map((trip) =>
          trip.id === tripId
            ? {
                ...trip,
                status: "Rejected" as const,
                rejectionReason: reason,
                rejectionRemarks: trimRemarks(remarks),
              }
            : trip,
        );

        return {
          ...requisition,
          trips,
          status: computeApplicationStatus(trips, requisition.requisitionType),
        };
      }),
    );
  }
  /**
   * Phase 6 — Admin's final sign-off (spec §5 Stage C).
   *
   * Per spec, once Admin approves the requisition it becomes
   * "Final Approved" and no separate Transport Administrator approval
   * is required. This is the action that unlocks the applicant-facing
   * confirmation slip download, so it's only allowed once every trip
   * has actually been approved (and, in the common single-trip case,
   * allocated a vehicle) — i.e. the requisition is already "Approved".
   */
  function finalApprove(requisitionId: string) {
    setRequisitions((current) =>
      current.map((requisition) =>
        requisition.id === requisitionId && requisition.status === "Approved"
          ? { ...requisition, status: "Final Approved" as const }
          : requisition,
      ),
    );
  }

  function markReadyForAccounts(requisitionId: string) {
    setRequisitions((current) =>
      current.map((requisition) =>
        requisition.id === requisitionId
          ? { ...requisition, status: "Ready for Accounts" as const }
          : requisition,
      ),
    );
  }
  function resetTripDecision(requisitionId: string, tripId: string) {
    setRequisitions((current) =>
      current.map((requisition) => {
        if (requisition.id !== requisitionId) {
          return requisition;
        }

        const trips = requisition.trips.map((trip) =>
          trip.id === tripId
            ? {
                ...trip,
                status: "Pending" as const,
                rejectionReason: undefined,
                rejectionRemarks: undefined,
              }
            : trip,
        );

        return {
          ...requisition,
          trips,
          status: computeApplicationStatus(trips, requisition.requisitionType),
        };
      }),
    );
  }

  /**
   * Phase 4 — recommender workflow (spec §5 Stage A).
   *
   * Recommend → forwards the requisition to the Admin queue.
   * The recommender's name is stamped onto the requisition so the
   * Admin review screen can surface who cleared it.
   */
  function recommendRequisition(
    requisitionId: string,
    recommenderName: string,
  ) {
    const trimmedName = recommenderName.trim();

    setRequisitions((current) =>
      current.map((requisition) => {
        if (requisition.id !== requisitionId) {
          return requisition;
        }

        // Per spec §3, a DepartmentHead acting as an applicant does not
        // require recommendation, so this helper is only ever called on
        // a "Pending Recommendation" requisition. We still guard the
        // transition so a double-fire doesn't silently downgrade.
        if (requisition.status !== "Pending Recommendation") {
          return requisition;
        }

        return {
          ...requisition,
          status: "Recommended",
          recommenderName: trimmedName || requisition.recommenderName,
        };
      }),
    );
  }

  /**
   * Phase 4 — recommender rejects the requisition outright. Reason is
   * required (callers must enforce this); remarks are optional.
   * The requisition is closed and removed from any active queue.
   */
  function rejectRequisition(
    requisitionId: string,
    reason: RejectionReason,
    remarks?: string,
  ) {
    setRequisitions((current) =>
      current.map((requisition) =>
        requisition.id === requisitionId
          ? {
              ...requisition,
              status: "Rejected" as const,
              recommenderName:
                requisition.recommenderName ??
                (trimRemarks(remarks) ? `Rejected: ${reason}` : undefined),
            }
          : requisition,
      ),
    );
  }

  /**
   * Phase 4 — recommender sends the requisition back to the applicant
   * for edits. Per spec §5 Stage A, a reason is required so the
   * applicant knows what to fix. The requisition transitions to
   * "Information Requested" so the applicant can re-open it from the
   * My Requisitions page (Phase 6).
   *
   * We do NOT mutate the trips — they're left as-is so the admin can
   * still see what was originally requested once the applicant
   * resubmits.
   */
  function sendBackToApplicant(
    requisitionId: string,
    reason: RejectionReason,
    remarks: string,
  ) {
    const trimmedRemarks = remarks.trim();
    if (!trimmedRemarks) {
      // The caller should validate this — we double-check so an
      // empty reason can't silently break the audit trail.
      throw new Error(
        "sendBackToApplicant requires a non-empty remarks string.",
      );
    }

    setRequisitions((current) =>
      current.map((requisition) =>
        requisition.id === requisitionId
          ? {
              ...requisition,
              status: "Information Requested" as const,
              trips: requisition.trips.map(
                (trip): Trip => ({
                  ...trip,
                  status: "Pending" as const,
                  rejectionReason: reason,
                  rejectionRemarks: trimmedRemarks,
                }),
              ),
            }
          : requisition,
      ),
    );
  }

  return {
    requisitions,
    addRequisition,
    deleteRequisition,
    approveTrip,
    rejectTrip,
    finalApprove,
    markReadyForAccounts,
    resetTripDecision,
    recommendRequisition,
    rejectRequisition,
    sendBackToApplicant,
  };
}
