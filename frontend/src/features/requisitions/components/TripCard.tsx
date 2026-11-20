import type { Allocation, Driver, Trip, Vehicle } from "@/types";
import { TripStatusBadge } from "@/shared/ui/StatusBadge";
import { buttonClass } from "@/shared/ui/buttonStyles";
import { SMALL_ACTION_BUTTON_CLASS } from "@/shared/ui/formStyles";

export type RequisitionDetailMode = "transportInCharge" | "transportAdministrator" | "viewOnly";

interface TripCardProps {
  trip: Trip;
  index: number;
  mode: RequisitionDetailMode;
  allocation?: Allocation;
  vehicle?: Vehicle;
  assignedDriver?: Driver;
  isRejecting: boolean;
  onAssignVehicle: () => void;
  onRemoveVehicle: () => void;
  onApprove: () => void;
  onStartReject: () => void;
  onComplete: () => void;
  onResetDecision: () => void;
  /** Rendered at the bottom of the card, e.g. the reject form. */
  children?: React.ReactNode;
}

export default function TripCard({
  trip,
  index,
  mode,
  allocation,
  vehicle,
  assignedDriver,
  isRejecting,
  onAssignVehicle,
  onRemoveVehicle,
  onApprove,
  onStartReject,
  onComplete,
  onResetDecision,
  children,
}: TripCardProps) {
  return (
    <div className="rounded-lg border border-form-rule bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-form-ink">
            Trip {index + 1} · {trip.date} · {trip.startTime}–{trip.endTime}
          </p>

          <p className="mt-1 text-sm text-form-muted">
            {trip.vehicleCategory} · {trip.route}
          </p>

          {trip.stoppageSequence.length > 0 && (
            <p className="mt-1 text-xs text-form-muted">{trip.stoppageSequence.join(" → ")}</p>
          )}

          {trip.passengerGroups.length > 0 && (
            <p className="mt-1 text-xs text-form-muted">
              Passengers: {trip.passengerGroups.join(", ")}
            </p>
          )}

          {trip.status === "Rejected" && (
            <p className="mt-2 text-xs font-medium text-error">
              Rejected — {trip.rejectionReason}
              {trip.rejectionRemarks ? `: ${trip.rejectionRemarks}` : ""}
            </p>
          )}

          {allocation && (
            <p
              className={`mt-2 text-xs font-medium ${
                trip.status === "Rejected" ? "text-form-muted line-through" : "text-success"
              }`}
            >
              Vehicle assigned —{" "}
              {vehicle ? `${vehicle.registrationNumber} (${vehicle.category})` : "Unknown vehicle"}
              {assignedDriver ? ` · Driver: ${assignedDriver.name}` : " · No driver"}
            </p>
          )}

          {!allocation && trip.status === "Pending" && mode === "transportAdministrator" && (
            <p className="mt-2 text-xs font-medium text-warning">
              No vehicle on file — this trip shouldn't have reached this queue without one. Send the
              application back to Transport In-Charge.
            </p>
          )}
        </div>

        <TripStatusBadge status={trip.status} />
      </div>

      {/* Transport In Charge — assign / change / remove vehicle */}
      {mode === "transportInCharge" && trip.status === "Pending" && (
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            onClick={() => onAssignVehicle()}
            className={SMALL_ACTION_BUTTON_CLASS}
          >
            {allocation ? "Change Vehicle" : "Assign Vehicle"}
          </button>

          {allocation && (
            <button
              type="button"
              onClick={() => onRemoveVehicle()}
              className={buttonClass("danger", "sm")}
            >
              Remove
            </button>
          )}
        </div>
      )}

      {/* Transport Administrator — approve / reject using the
                    vehicle already on file */}
      {mode === "transportAdministrator" && trip.status === "Pending" && !isRejecting && (
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            onClick={() => onApprove()}
            disabled={!allocation}
            className={buttonClass("success", "sm")}
          >
            Approve
          </button>

          <button
            type="button"
            onClick={() => onStartReject()}
            className={buttonClass("danger", "sm")}
          >
            Reject
          </button>
        </div>
      )}

      {/* Transport Administrator — mark an approved trip
                    Completed once it's actually happened (FRD §22),
                    independent of approve/reject and of mileage */}
      {mode === "transportAdministrator" && trip.status === "Approved" && (
        <div className="mt-3 flex items-center gap-3">
          <button type="button" onClick={() => onComplete()} className={SMALL_ACTION_BUTTON_CLASS}>
            Mark Completed
          </button>

          <button
            type="button"
            onClick={() => onResetDecision()}
            className="text-xs font-medium text-secondary hover:underline"
          >
            Undo decision
          </button>
        </div>
      )}

      {mode === "transportAdministrator" && trip.status === "Rejected" && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => onResetDecision()}
            className="text-xs font-medium text-secondary hover:underline"
          >
            Undo decision
          </button>
        </div>
      )}

      {children}
    </div>
  );
}
