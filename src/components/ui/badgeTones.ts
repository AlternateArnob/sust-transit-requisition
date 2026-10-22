import type { ApplicationStatus, Requisition, Trip } from "../../types";

export type BadgeTone =
  | "neutral"
  | "info"
  | "review"
  | "success"
  | "warning"
  | "danger"
  | "personal"
  | "official"
  | "club";

export const TONES: Record<BadgeTone, string> = {
  neutral: "bg-neutral-bg text-neutral",
  info: "bg-info-bg text-info",
  review: "bg-review-bg text-review",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-error-bg text-error",
  personal: "bg-type-personal-bg text-type-personal",
  official: "bg-type-official-bg text-type-official",
  club: "bg-type-club-bg text-type-club",
};

/** Colour tone for each whole-application status (one place, not per page). */
export function applicationStatusTone(status: ApplicationStatus): BadgeTone {
  switch (status) {
    case "Approved":
      return "success";
    case "Completed":
    case "Draft":
    case "Ready for Accounts":
      return "neutral";
    case "Rejected":
      return "danger";
    case "Pending Administrator":
      return "review";
    case "Information Requested":
    case "Partially Approved":
      return "warning";
    default:
      return "info";
  }
}

export function tripStatusTone(status: Trip["status"]): BadgeTone {
  if (status === "Approved") return "success";
  if (status === "Rejected") return "danger";
  return "neutral";
}

export function requisitionTypeTone(type: Requisition["requisitionType"]): BadgeTone {
  if (type === "Personal") return "personal";
  if (type === "Departmental/Official") return "official";
  return "club";
}
