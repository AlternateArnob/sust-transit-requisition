import type { StaffStatus } from "../types";

interface StaffStatusBadgeProps {
  status: StaffStatus;
}

export default function StaffStatusBadge({ status }: StaffStatusBadgeProps) {
  const styles: Record<StaffStatus, string> = {
    Active: "bg-[#DCFCE7] text-[#15803D]",
    Inactive: "bg-[#F1F5F9] text-[#64748B]",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}
