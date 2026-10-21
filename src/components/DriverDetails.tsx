import type { Driver } from "../types";
import DriverStatusBadge from "./DriverStatusBadge";

interface DriverDetailsProps {
  driver: Driver;
  vehicleRegistration?: string;
}

export default function DriverDetails({
  driver,
  vehicleRegistration,
}: DriverDetailsProps) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
          Driver Name
        </p>

        <p className="mt-1 font-semibold text-text">{driver.name}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Designation
          </p>

          <p className="mt-1 text-sm text-text">{driver.designation}</p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Phone
          </p>

          <p className="mt-1 text-sm text-text">{driver.phone ?? "—"}</p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Status
          </p>

          <div className="mt-1">
            <DriverStatusBadge status={driver.status} />
          </div>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Permanent Vehicle
          </p>

          <p className="mt-1 text-sm text-text">
            {vehicleRegistration ?? "No vehicle assigned"}
          </p>
        </div>
      </div>
    </div>
  );
}
