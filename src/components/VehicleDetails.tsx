import type { Vehicle } from "../types";
import StatusBadge from "./StatusBadge";

interface VehicleDetailsProps {
  vehicle: Vehicle;
}

export default function VehicleDetails({ vehicle }: VehicleDetailsProps) {
  return (
    <div className="space-y-5">
      {/* Registration */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
          Registration Number
        </p>

        <p className="mt-1 text-base font-semibold text-[#1E293B]">
          {vehicle.registrationNumber}
        </p>
      </div>

      {/* Vehicle Information */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
            Category
          </p>

          <p className="mt-1 text-sm text-[#1E293B]">{vehicle.category}</p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
            Fuel Type
          </p>

          <p className="mt-1 text-sm text-[#1E293B]">
            {vehicle.fuelType ?? "—"}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
            Operational Status
          </p>

          <div className="mt-1">
            <StatusBadge status={vehicle.operationalStatus} />
          </div>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
            Requisition Eligibility
          </p>

          <p
            className={`mt-1 text-sm font-medium ${
              vehicle.availableForRequisition
                ? "text-[#15803D]"
                : "text-[#64748B]"
            }`}
          >
            {vehicle.availableForRequisition ? "Yes" : "No"}
          </p>
        </div>
      </div>

      {/* Reservation */}
      <div className="border-t border-[#E2E8F0] pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
          Reserved For
        </p>

        <p className="mt-1 text-sm text-[#1E293B]">
          {vehicle.reservedFor ?? "Not reserved"}
        </p>
      </div>
    </div>
  );
}
