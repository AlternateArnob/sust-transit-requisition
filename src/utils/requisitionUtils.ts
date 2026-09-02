import type {
  Requisition,
  Trip,
  ApplicationStatus,
  RequisitionType,
} from "../types";

export function computeApplicationStatus(
  trips: Trip[],
  requisitionType: RequisitionType,
): ApplicationStatus {
  // Personal requisitions skip the recommender workflow entirely and go
  // straight to the Transport Administrator, so they should never show
  // "Recommended" — every other type enters the queue as "Recommended".
  const defaultStatus: ApplicationStatus =
    requisitionType === "Personal" ? "Pending Approval" : "Recommended";

  if (trips.length === 0) {
    return defaultStatus;
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

  return defaultStatus;
}

export function isInActiveQueue(requisition: Requisition): boolean {
  return (
    requisition.status === "Recommended" ||
    requisition.status === "Pending Approval" ||
    requisition.status === "Partially Approved"
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
