import type { Staff } from "../types";
import StaffStatusBadge from "./StaffStatusBadge";

interface StaffDetailsProps {
  staff: Staff;
  vehicleRegistration?: string;
}

export default function StaffDetails({
  staff,
  vehicleRegistration,
}: StaffDetailsProps) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
          Driver Name
        </p>

        <p className="mt-1 font-semibold text-[#1E293B]">{staff.name}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
            Designation
          </p>

          <p className="mt-1 text-sm text-[#1E293B]">{staff.designation}</p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
            Phone
          </p>

          <p className="mt-1 text-sm text-[#1E293B]">{staff.phone ?? "—"}</p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
            Status
          </p>

          <div className="mt-1">
            <StaffStatusBadge status={staff.status} />
          </div>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
            Permanent Vehicle
          </p>

          <p className="mt-1 text-sm text-[#1E293B]">
            {vehicleRegistration ?? "No vehicle assigned"}
          </p>
        </div>
      </div>
    </div>
  );
}
