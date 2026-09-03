import type { Requisition, Vehicle, Driver, Allocation } from "../types";
import { formatDateRange } from "../utils/requisitionUtils";

interface ApplicantRequisitionDetailProps {
  requisition: Requisition;
  vehicles: Vehicle[];
  driver: Driver[];
  allocations: Allocation[];
  onDownloadConfirmationSlip: () => void;
}

function statusBadgeClass(status: Requisition["status"]) {
  if (status === "Final Approved") return "bg-[#BBF7D0] text-[#15803D]";
  if (status === "Approved") return "bg-[#DCFCE7] text-[#15803D]";
  if (status === "Rejected") return "bg-[#FEE2E2] text-[#B91C1C]";
  if (status === "Information Requested") return "bg-[#FEF3C7] text-[#B45309]";
  if (status === "Partially Approved") return "bg-[#FEF3C7] text-[#B45309]";
  if (status === "Draft") return "bg-[#F1F5F9] text-[#64748B]";
  return "bg-[#DBEAFE] text-[#0F2747]";
}

/**
 * Phase 6 — read-only requisition detail for the applicant. Deliberately
 * separate from the admin-facing `RequisitionDetail`, which exposes
 * approve/reject/allocate actions that must never be reachable from an
 * applicant's own view of their requisition.
 */
export default function ApplicantRequisitionDetail({
  requisition,
  vehicles,
  driver,
  allocations,
  onDownloadConfirmationSlip,
}: ApplicantRequisitionDetailProps) {
  const isFinalApproved = requisition.status === "Final Approved";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-[#64748B]">
          Reference: <span className="text-[#1E293B]">{requisition.id}</span>
        </p>
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(
            requisition.status,
          )}`}
        >
          {requisition.status}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-[#64748B]">Type</p>
          <p className="text-sm text-[#1E293B]">
            {requisition.requisitionType}
          </p>
        </div>

        {requisition.department && (
          <div>
            <p className="text-xs font-medium text-[#64748B]">
              Department / Office
            </p>
            <p className="text-sm text-[#1E293B]">{requisition.department}</p>
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-[#64748B]">Date</p>
          <p className="text-sm text-[#1E293B]">
            {formatDateRange(requisition.startDate, requisition.endDate)}
          </p>
        </div>

        {requisition.recommenderName && (
          <div>
            <p className="text-xs font-medium text-[#64748B]">
              Recommended by
            </p>
            <p className="text-sm text-[#1E293B]">
              {requisition.recommenderName}
            </p>
          </div>
        )}

        <div className="sm:col-span-2">
          <p className="text-xs font-medium text-[#64748B]">Purpose</p>
          <p className="text-sm text-[#1E293B]">{requisition.purpose}</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-[#1E293B]">
          Trip{requisition.trips.length === 1 ? "" : "s"} (
          {requisition.trips.length})
        </p>

        <div className="space-y-3">
          {requisition.trips.length === 0 ? (
            <p className="text-sm text-[#64748B]">No trip details yet.</p>
          ) : (
            requisition.trips.map((trip, index) => {
              const allocation = allocations.find(
                (item) => item.tripId === trip.id,
              );
              const vehicle = allocation
                ? vehicles.find((item) => item.id === allocation.vehicleId)
                : undefined;
              const assignedDriver = allocation?.driverId
                ? driver.find((item) => item.id === allocation.driverId)
                : undefined;

              return (
                <div
                  key={trip.id}
                  className="rounded-md border border-[#E2E8F0] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-[#1E293B]">
                        {requisition.trips.length > 1
                          ? `Trip ${index + 1} · `
                          : ""}
                        {trip.date} · {trip.startTime}–{trip.endTime}
                      </p>
                      <p className="mt-1 text-sm text-[#64748B]">
                        {trip.route}
                      </p>

                      {trip.status === "Rejected" && (
                        <p className="mt-2 text-xs font-medium text-[#B91C1C]">
                          Rejected — {trip.rejectionReason}
                          {trip.rejectionRemarks
                            ? `: ${trip.rejectionRemarks}`
                            : ""}
                        </p>
                      )}

                      {trip.status === "Approved" && (
                        <p className="mt-2 text-xs font-medium text-[#15803D]">
                          {vehicle
                            ? `Vehicle: ${vehicle.registrationNumber} (${vehicle.category})`
                            : "Approved — awaiting vehicle allocation"}
                          {assignedDriver
                            ? ` · Driver: ${assignedDriver.name}`
                            : ""}
                        </p>
                      )}
                    </div>

                    <span
                      className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                        trip.status === "Approved"
                          ? "bg-[#DCFCE7] text-[#15803D]"
                          : trip.status === "Rejected"
                            ? "bg-[#FEE2E2] text-[#B91C1C]"
                            : "bg-[#F1F5F9] text-[#64748B]"
                      }`}
                    >
                      {trip.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="border-t border-[#E2E8F0] pt-4">
        <p className="mb-2 text-sm font-medium text-[#1E293B]">Documents</p>

        {isFinalApproved ? (
          <button
            type="button"
            onClick={onDownloadConfirmationSlip}
            className="h-9 rounded-md bg-[#0F2747] px-3 text-sm font-medium text-white hover:bg-[#334E68]"
          >
            Download Confirmation Slip
          </button>
        ) : (
          <p className="text-sm text-[#64748B]">
            The confirmation slip becomes available once Admin gives final
            approval.
          </p>
        )}
      </div>
    </div>
  );
}
