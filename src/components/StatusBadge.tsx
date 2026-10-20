import type { VehicleStatus } from "../types";

interface StatusBadgeProps {
  status: VehicleStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const statusStyles: Record<VehicleStatus, string> = {
    Active: "bg-[#DCFCE7] text-[#15803D]",
    "Under Maintenance": "bg-[#FEF3C7] text-[#B45309]",
    "Out-of-Service": "bg-[#FEE2E2] text-[#B91C1C]",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[status]}`}
    >
      {status}
    </span>
  );
}
