import type { DriverStatus } from "../types";

interface DriverStatusBadgeProps {
  status: DriverStatus;
}

export default function DriverStatusBadge({ status }: DriverStatusBadgeProps) {
  const styles: Record<DriverStatus, string> = {
    Active: "bg-success-bg text-success",
    Inactive: "bg-neutral-bg text-text-muted",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}
