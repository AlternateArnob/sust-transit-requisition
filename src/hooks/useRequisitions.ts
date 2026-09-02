import { useEffect, useState } from "react";
import type { Requisition, RejectionReason } from "../types";
import { computeApplicationStatus } from "../utils/requisitionUtils";

const STORAGE_KEY = "sust-transit-requisitions";

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
                rejectionRemarks: remarks?.trim() || undefined,
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

  return {
    requisitions,
    addRequisition,
    deleteRequisition,
    approveTrip,
    rejectTrip,
    markReadyForAccounts,
    resetTripDecision,
  };
}
