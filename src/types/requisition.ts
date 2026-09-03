import type { Trip } from "./trip";

export type RequisitionType = "Club" | "Official" | "Personal" | "Departmental";

export const REQUISITION_TYPES: RequisitionType[] = [
  "Club",
  "Official",
  "Personal",
  "Departmental",
];

export type ApplicantType = "Individual" | "Organization";

export const APPLICANT_TYPES: ApplicantType[] = ["Individual", "Organization"];

export type ApplicationStatus =
  | "Draft"
  | "Pending Recommendation"
  | "Information Requested"
  | "Recommended"
  | "Pending Approval"
  | "Partially Approved"
  | "Approved"
  | "Final Approved"
  | "Ready for Accounts"
  | "Rejected";

export type TripStatus = "Pending" | "Approved" | "Rejected";

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
  applicantType: ApplicantType;
  department?: string;
  contactNumber?: string;
  requisitionType: RequisitionType;
  purpose: string;
  startDate: string;
  endDate: string;
  scheduleType: ScheduleType;
  status: ApplicationStatus;
  recommenderName?: string;
  createdAt: string;
  trips: Trip[];
}
