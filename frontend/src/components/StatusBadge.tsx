import type { VehicleStatus } from "../types";

interface StatusBadgeProps {
  status: VehicleStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const statusStyles: Record<VehicleStatus, string> = {
    Active: "bg-success-bg text-success",
    "Under Maintenance": "bg-warning-bg text-warning",
    "Out-of-Service": "bg-error-bg text-error",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[status]}`}
    >
      {status}
    </span>
  );
}
