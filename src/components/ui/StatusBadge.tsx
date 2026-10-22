import type { ApplicationStatus, Requisition, Trip } from "../../types";

import {
  TONES,
  applicationStatusTone,
  requisitionTypeTone,
  tripStatusTone,
  type BadgeTone,
} from "./badgeTones";

interface StatusBadgeProps {
  tone: BadgeTone;
  children: React.ReactNode;
  className?: string;
}

/** Small rounded status pill. Prefer the helpers below for the common cases. */
export default function StatusBadge({ tone, children, className = "" }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return <StatusBadge tone={applicationStatusTone(status)}>{status}</StatusBadge>;
}

export function TripStatusBadge({ status }: { status: Trip["status"] }) {
  return <StatusBadge tone={tripStatusTone(status)}>{status}</StatusBadge>;
}

export function RequisitionTypeBadge({ type }: { type: Requisition["requisitionType"] }) {
  return <StatusBadge tone={requisitionTypeTone(type)}>{type}</StatusBadge>;
}
