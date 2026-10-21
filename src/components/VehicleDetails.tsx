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
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
          Registration Number
        </p>

        <p className="mt-1 text-base font-semibold text-text">
          {vehicle.registrationNumber}
        </p>
      </div>

      {/* Vehicle Information */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Category
          </p>

          <p className="mt-1 text-sm text-text">{vehicle.category}</p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Fuel Type
          </p>

          <p className="mt-1 text-sm text-text">
            {vehicle.fuelType ?? "—"}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Operational Status
          </p>

          <div className="mt-1">
            <StatusBadge status={vehicle.operationalStatus} />
          </div>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Requisition Eligibility
          </p>

          <p
            className={`mt-1 text-sm font-medium ${
              vehicle.availableForRequisition
                ? "text-success"
                : "text-text-muted"
            }`}
          >
            {vehicle.availableForRequisition ? "Yes" : "No"}
          </p>
        </div>
      </div>

      {/* Reservation */}
      <div className="border-t border-border pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
          Reserved For
        </p>

        <p className="mt-1 text-sm text-text">
          {vehicle.reservedFor ?? "Not reserved"}
        </p>
      </div>
    </div>
  );
}
