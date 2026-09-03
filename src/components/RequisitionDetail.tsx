import { useState } from "react";

import {
  REJECTION_REASONS,
  type Requisition,
  type RejectionReason,
  type Trip,
  type Vehicle,
  type Driver,
  type Allocation,
  type DutySlip,
} from "../types";
import { formatDateRange } from "../utils/requisitionUtils";
import {
  getEligibleDutySlipGroups,
  getLatestSlipForDriver,
  isDutySlipSuperseded,
} from "../utils/dutySlipUtils";
import Modal from "./Modal";
import AllocationPicker from "./AllocationPicker";

interface RequisitionDetailProps {
  requisition: Requisition;
  vehicles: Vehicle[];
  driver: Driver[];
  allocations: Allocation[];
  dutySlips: DutySlip[];
  onApproveTripWithVehicle: (
    requisitionId: string,
    tripId: string,
    vehicleId: string,
    driverId?: string,
  ) => void;
  onRejectTrip: (
    requisitionId: string,
    tripId: string,
    reason: RejectionReason,
    remarks?: string,
  ) => void;
  onResetTrip: (requisitionId: string, tripId: string) => void;
  onGenerateConfirmationSlip: () => void;
  onGenerateDutySlip: (driverId: string) => void;
  /**
   * Phase 6 — Admin's final sign-off (spec §5 Stage C). Only relevant
   * once the requisition's own status is "Approved"; omit or leave
   * undefined to hide the action entirely (e.g. read-only contexts).
   */
  onFinalApprove?: () => void;
}

function statusBadgeClass(status: Trip["status"]) {
  if (status === "Approved") {
    return "bg-[#DCFCE7] text-[#15803D]";
  }

  if (status === "Rejected") {
    return "bg-[#FEE2E2] text-[#B91C1C]";
  }

  return "bg-[#F1F5F9] text-[#64748B]";
}

export default function RequisitionDetail({
  requisition,
  vehicles,
  driver,
  allocations,
  dutySlips,
  onApproveTripWithVehicle,
  onRejectTrip,
  onResetTrip,
  onGenerateConfirmationSlip,
  onGenerateDutySlip,
  onFinalApprove,
}: RequisitionDetailProps) {
  const [rejectingTripId, setRejectingTripId] = useState<string | null>(null);
  const [reason, setReason] = useState<RejectionReason>(REJECTION_REASONS[0]);
  const [remarks, setRemarks] = useState("");
  const [allocatingTrip, setAllocatingTrip] = useState<Trip | null>(null);

  function handleVehicleSelected(vehicleId: string, driverId?: string) {
    if (!allocatingTrip) {
      return;
    }

    onApproveTripWithVehicle(
      requisition.id,
      allocatingTrip.id,
      vehicleId,
      driverId,
    );
    setAllocatingTrip(null);
  }

  const dutySlipGroups = getEligibleDutySlipGroups(requisition, allocations);

  function startReject(tripId: string) {
    setRejectingTripId(tripId);
    setReason(REJECTION_REASONS[0]);
    setRemarks("");
  }

  function confirmReject(tripId: string) {
    onRejectTrip(requisition.id, tripId, reason, remarks);
    setRejectingTripId(null);
  }

  return (
    <div className="space-y-5">
      {/* Requester Info */}
      <div className="grid grid-cols-1 gap-3 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-[#64748B]">Requester</p>
          <p className="text-sm text-[#1E293B]">
            {requisition.requesterName} ({requisition.applicantType})
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-[#64748B]">Type</p>
          <p className="text-sm text-[#1E293B]">
            {requisition.requisitionType}
          </p>
        </div>

        {requisition.department && (
          <div>
            <p className="text-xs font-medium text-[#64748B]">
              Department / Organization
            </p>
            <p className="text-sm text-[#1E293B]">{requisition.department}</p>
          </div>
        )}

        {requisition.contactNumber && (
          <div>
            <p className="text-xs font-medium text-[#64748B]">Contact</p>
            <p className="text-sm text-[#1E293B]">
              {requisition.contactNumber}
            </p>
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-[#64748B]">Date Range</p>
          <p className="text-sm text-[#1E293B]">
            {formatDateRange(requisition.startDate, requisition.endDate)}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-[#64748B]">Schedule Type</p>
          <p className="text-sm text-[#1E293B]">{requisition.scheduleType}</p>
        </div>

        <div className="sm:col-span-2">
          <p className="text-xs font-medium text-[#64748B]">Purpose</p>
          <p className="text-sm text-[#1E293B]">{requisition.purpose}</p>
        </div>
      </div>

      {/* Trips */}
      <div>
        <p className="mb-2 text-sm font-medium text-[#1E293B]">
          Trip Requests ({requisition.trips.length})
        </p>

        <div className="space-y-3">
          {requisition.trips.map((trip, index) => (
            <div
              key={trip.id}
              className="rounded-md border border-[#E2E8F0] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-[#1E293B]">
                    Trip {index + 1} · {trip.date} · {trip.startTime}–
                    {trip.endTime}
                  </p>

                  <p className="mt-1 text-sm text-[#64748B]">
                    {trip.vehicleCategory} · {trip.route}
                  </p>

                  {trip.stoppageSequence.length > 0 && (
                    <p className="mt-1 text-xs text-[#64748B]">
                      {trip.stoppageSequence.join(" → ")}
                    </p>
                  )}

                  {trip.passengerGroups.length > 0 && (
                    <p className="mt-1 text-xs text-[#64748B]">
                      Passengers: {trip.passengerGroups.join(", ")}
                    </p>
                  )}

                  {trip.status === "Rejected" && (
                    <p className="mt-2 text-xs font-medium text-[#B91C1C]">
                      Rejected — {trip.rejectionReason}
                      {trip.rejectionRemarks
                        ? `: ${trip.rejectionRemarks}`
                        : ""}
                    </p>
                  )}

                  {trip.status === "Approved" &&
                    (() => {
                      const allocation = allocations.find(
                        (item) => item.tripId === trip.id,
                      );

                      if (!allocation) {
                        return (
                          <p className="mt-2 text-xs font-medium text-[#B45309]">
                            Approved — awaiting vehicle allocation (go to the
                            Allocation page to assign a vehicle)
                          </p>
                        );
                      }

                      const vehicle = vehicles.find(
                        (item) => item.id === allocation.vehicleId,
                      );
                      const assignedDriver = driver.find(
                        (item) => item.id === allocation.driverId,
                      );

                      return (
                        <p className="mt-2 text-xs font-medium text-[#15803D]">
                          Allocated —{" "}
                          {vehicle
                            ? `${vehicle.registrationNumber} (${vehicle.category})`
                            : "Unknown vehicle"}
                          {assignedDriver
                            ? ` · Driver: ${assignedDriver.name}`
                            : " · No driver"}
                        </p>
                      );
                    })()}
                </div>

                <span
                  className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(
                    trip.status,
                  )}`}
                >
                  {trip.status}
                </span>
              </div>

              {trip.status === "Pending" && rejectingTripId !== trip.id && (
                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setRejectingTripId(null);
                      setAllocatingTrip(trip);
                    }}
                    className="h-8 rounded-md bg-[#15803D] px-3 text-xs font-medium text-white hover:opacity-90"
                  >
                    Approve & Select Vehicle
                  </button>

                  <button
                    type="button"
                    onClick={() => startReject(trip.id)}
                    className="h-8 rounded-md border border-[#E2E8F0] px-3 text-xs font-medium text-[#B91C1C] hover:bg-[#F8FAFC]"
                  >
                    Reject
                  </button>
                </div>
              )}

              {trip.status !== "Pending" && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => onResetTrip(requisition.id, trip.id)}
                    className="text-xs font-medium text-[#334E68] hover:underline"
                  >
                    Undo decision
                  </button>
                </div>
              )}

              {rejectingTripId === trip.id && (
                <div className="mt-3 space-y-2 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#64748B]">
                      Rejection Reason
                    </label>

                    <select
                      value={reason}
                      onChange={(event) =>
                        setReason(event.target.value as RejectionReason)
                      }
                      className="h-9 w-full rounded-md border border-[#E2E8F0] bg-white px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
                    >
                      {REJECTION_REASONS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#64748B]">
                      Remarks (optional)
                    </label>

                    <input
                      type="text"
                      value={remarks}
                      onChange={(event) => setRemarks(event.target.value)}
                      className="h-9 w-full rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setRejectingTripId(null)}
                      className="h-8 rounded-md border border-[#E2E8F0] bg-white px-3 text-xs font-medium text-[#334E68] hover:bg-[#F8FAFC]"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={() => confirmReject(trip.id)}
                      className="h-8 rounded-md bg-[#B91C1C] px-3 text-xs font-medium text-white hover:opacity-90"
                    >
                      Confirm Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Final sign-off (spec §5 Stage C) */}
      {requisition.status === "Approved" && onFinalApprove && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#BBF7D0] bg-[#F0FDF4] p-4">
          <p className="text-sm text-[#15803D]">
            All trips are approved and allocated. Final approval marks this
            requisition complete and unlocks the confirmation slip download
            for the applicant.
          </p>
          <button
            type="button"
            onClick={onFinalApprove}
            className="h-9 shrink-0 rounded-md bg-[#15803D] px-4 text-sm font-medium text-white hover:opacity-90"
          >
            Final Approve
          </button>
        </div>
      )}

      {requisition.status === "Final Approved" && (
        <div className="rounded-md border border-[#BBF7D0] bg-[#F0FDF4] p-4 text-sm text-[#15803D]">
          Final Approved — the applicant can now download their confirmation
          slip.
        </div>
      )}

      {/* Documents */}
      <div className="border-t border-[#E2E8F0] pt-4">
        <p className="mb-2 text-sm font-medium text-[#1E293B]">Documents</p>

        <button
          type="button"
          onClick={onGenerateConfirmationSlip}
          className="mb-3 h-9 rounded-md border border-[#E2E8F0] px-3 text-sm font-medium text-[#334E68] hover:bg-[#F8FAFC]"
        >
          Download Confirmation Slip
        </button>

        {dutySlipGroups.length === 0 ? (
          <p className="text-sm text-[#64748B]">
            No approved & allocated trips yet — duty slips become available once
            trips are allocated.
          </p>
        ) : (
          <div className="space-y-2">
            {dutySlipGroups.map((group) => {
              const assignedDriver = driver.find(
                (member) => member.id === group.driverId,
              );
              const latestSlip = getLatestSlipForDriver(
                requisition.id,
                group.driverId,
                dutySlips,
              );
              const superseded = latestSlip
                ? isDutySlipSuperseded(latestSlip, allocations)
                : false;

              return (
                <div
                  key={group.driverId}
                  className="flex items-center justify-between rounded-md border border-[#E2E8F0] px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-[#1E293B]">
                      {assignedDriver?.name ?? "Unknown Driver"}
                    </p>

                    <p className="text-xs text-[#64748B]">
                      {group.trips.length} assigned day(s)
                    </p>

                    {latestSlip && (
                      <span
                        className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          superseded
                            ? "bg-[#FEE2E2] text-[#B91C1C]"
                            : "bg-[#DCFCE7] text-[#15803D]"
                        }`}
                      >
                        {superseded ? "Superseded — see new slip" : "Active"}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onGenerateDutySlip(group.driverId)}
                    className="h-8 rounded-md bg-[#0F2747] px-3 text-xs font-medium text-white hover:bg-[#334E68]"
                  >
                    {latestSlip ? "Regenerate Duty Slip" : "Generate Duty Slip"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {allocatingTrip && (
        <Modal
          title="Approve Trip — Select Vehicle"
          onClose={() => setAllocatingTrip(null)}
          wide
        >
          <AllocationPicker
            trip={allocatingTrip}
            allocations={allocations}
            onSelect={handleVehicleSelected}
            onCancel={() => setAllocatingTrip(null)}
          />
        </Modal>
      )}
    </div>
  );
}
