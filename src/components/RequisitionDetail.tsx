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
import { formatDateRange, requisitionTypeBadgeClass } from "../utils/requisitionUtils";
import {
  getTripsMissingVehicleAssignment,
  canForwardToAdministrator,
} from "../utils/allocationUtils";
import {
  getEligibleDutySlipGroups,
  getDutySlipHistory,
  hasStaleVehicleAssignment,
  canGenerateSlips,
} from "../utils/dutySlipUtils";
import Modal from "./Modal";
import AllocationPicker from "./AllocationPicker";

/**
 * Phase 1 (admin module) — this used to be a single admin-only view that
 * both assigned a vehicle AND made the final approve/reject call in the
 * same action. The FRD splits that into two roles (§9, §19), so this
 * component now renders one of three modes instead:
 *
 *  - "transportInCharge": assign a vehicle per trip, forward the whole
 *    application on, or send it back to the applicant.
 *  - "transportAdministrator": approve/reject each trip using the
 *    vehicle Transport In Charge already picked, send the whole
 *    application back to Transport In Charge, or generate slips.
 *  - "viewOnly": Super Admin oversight — read-only, no action affordances.
 *
 * Keeping this as one component (instead of three near-duplicates) means
 * the trip list / documents markup stays in exactly one place.
 */
type Mode = "transportInCharge" | "transportAdministrator" | "viewOnly";

interface RequisitionDetailProps {
  requisition: Requisition;
  vehicles: Vehicle[];
  driver: Driver[];
  allocations: Allocation[];
  dutySlips: DutySlip[];
  mode: Mode;

  // Transport In Charge stage (FRD §9) — omit in other modes.
  onAssignVehicle?: (tripId: string, vehicleId: string, driverId?: string) => void;
  onRemoveVehicleAssignment?: (tripId: string) => void;
  onForwardToAdministrator?: () => void;
  onSendBackToApplicant?: (reason: RejectionReason, remarks: string) => void;

  // Transport Administrator stage (FRD §19) — omit in other modes.
  onApproveTrip?: (tripId: string) => void;
  onRejectTrip?: (tripId: string, reason: RejectionReason, remarks?: string) => void;
  onResetTripDecision?: (tripId: string) => void;
  onSendBackToTransportInCharge?: (remarks: string) => void;
  onGenerateConfirmationSlip?: () => void;
  onGenerateDutySlip?: (driverId: string) => void;
  /** Phase 6 (FRD §22) — Transport Office marks a trip Completed once it
   *  actually happened. Independent of approve/reject and of mileage. */
  onCompleteTrip?: (tripId: string) => void;
}

function statusBadgeClass(status: Trip["status"]) {
  if (status === "Approved") {
    return "bg-[#DCFCE7] text-[#15803D]";
  }

  if (status === "Completed") {
    return "bg-[#CBD5E1] text-[#1E293B]";
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
  mode,
  onAssignVehicle,
  onRemoveVehicleAssignment,
  onForwardToAdministrator,
  onSendBackToApplicant,
  onApproveTrip,
  onRejectTrip,
  onResetTripDecision,
  onSendBackToTransportInCharge,
  onGenerateConfirmationSlip,
  onGenerateDutySlip,
  onCompleteTrip,
}: RequisitionDetailProps) {
  const [rejectingTripId, setRejectingTripId] = useState<string | null>(null);
  const [reason, setReason] = useState<RejectionReason>(REJECTION_REASONS[0]);
  const [remarks, setRemarks] = useState("");
  const [allocatingTrip, setAllocatingTrip] = useState<Trip | null>(null);
  const [showSendBackToApplicant, setShowSendBackToApplicant] = useState(false);
  const [showSendBackToTIC, setShowSendBackToTIC] = useState(false);
  // Phase 5, §2.2 — which drivers' superseded-slip history is expanded.
  const [expandedHistory, setExpandedHistory] = useState<
    Record<string, boolean>
  >({});

  function handleVehicleSelected(vehicleId: string, driverId?: string) {
    if (!allocatingTrip || !onAssignVehicle) {
      return;
    }

    onAssignVehicle(allocatingTrip.id, vehicleId, driverId);
    setAllocatingTrip(null);
  }

  const dutySlipGroups = getEligibleDutySlipGroups(requisition, allocations);
  const missingVehicle = getTripsMissingVehicleAssignment(
    requisition,
    allocations,
  );
  const canForward = canForwardToAdministrator(requisition, allocations);
  const slipsGeneratable = canGenerateSlips(requisition);

  function startReject(tripId: string) {
    setRejectingTripId(tripId);
    setReason(REJECTION_REASONS[0]);
    setRemarks("");
  }

  function confirmReject(tripId: string) {
    onRejectTrip?.(tripId, reason, remarks);
    setRejectingTripId(null);
  }

  function findAllocationForTrip(tripId: string) {
    return allocations.find((item) => item.tripId === tripId);
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
          <span
            className={`mt-0.5 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${requisitionTypeBadgeClass(requisition.requisitionType)}`}
          >
            {requisition.requisitionType}
          </span>
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

      {/* Phase 1 — Administrator's send-back reason, visible to Transport
          In Charge until they forward it again. */}
      {requisition.transportOfficeRemarks && mode === "transportInCharge" && (
        <div className="rounded-md border border-[#FED7AA] bg-[#FFF7ED] p-4 text-sm text-[#9A3412]">
          <p className="font-medium">Sent back by Transport Administrator</p>
          <p className="mt-1">{requisition.transportOfficeRemarks}</p>
        </div>
      )}

      {/* Trips */}
      <div>
        <p className="mb-2 text-sm font-medium text-[#1E293B]">
          Trip Requests ({requisition.trips.length})
        </p>

        <div className="space-y-3">
          {requisition.trips.map((trip, index) => {
            const allocation = findAllocationForTrip(trip.id);
            const vehicle = allocation
              ? vehicles.find((item) => item.id === allocation.vehicleId)
              : undefined;
            const assignedDriver = allocation
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

                    {allocation && (
                      <p
                        className={`mt-2 text-xs font-medium ${
                          trip.status === "Rejected"
                            ? "text-[#64748B] line-through"
                            : "text-[#15803D]"
                        }`}
                      >
                        Vehicle assigned —{" "}
                        {vehicle
                          ? `${vehicle.registrationNumber} (${vehicle.category})`
                          : "Unknown vehicle"}
                        {assignedDriver
                          ? ` · Driver: ${assignedDriver.name}`
                          : " · No driver"}
                      </p>
                    )}

                    {!allocation &&
                      trip.status === "Pending" &&
                      mode === "transportAdministrator" && (
                        <p className="mt-2 text-xs font-medium text-[#B45309]">
                          No vehicle on file — this trip shouldn't have
                          reached this queue without one. Send the
                          application back to Transport In Charge.
                        </p>
                      )}
                  </div>

                  <span
                    className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(
                      trip.status,
                    )}`}
                  >
                    {trip.status}
                  </span>
                </div>

                {/* Transport In Charge — assign / change / remove vehicle */}
                {mode === "transportInCharge" && trip.status === "Pending" && (
                  <div className="mt-3 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setAllocatingTrip(trip)}
                      className="h-8 rounded-md bg-[#0F2747] px-3 text-xs font-medium text-white hover:bg-[#334E68]"
                    >
                      {allocation ? "Change Vehicle" : "Assign Vehicle"}
                    </button>

                    {allocation && (
                      <button
                        type="button"
                        onClick={() => onRemoveVehicleAssignment?.(trip.id)}
                        className="h-8 rounded-md border border-[#E2E8F0] px-3 text-xs font-medium text-[#B91C1C] hover:bg-[#F8FAFC]"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )}

                {/* Transport Administrator — approve / reject using the
                    vehicle already on file */}
                {mode === "transportAdministrator" &&
                  trip.status === "Pending" &&
                  rejectingTripId !== trip.id && (
                    <div className="mt-3 flex gap-3">
                      <button
                        type="button"
                        onClick={() => onApproveTrip?.(trip.id)}
                        disabled={!allocation}
                        className="h-8 rounded-md bg-[#15803D] px-3 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Approve
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

                {/* Transport Administrator — mark an approved trip
                    Completed once it's actually happened (FRD §22),
                    independent of approve/reject and of mileage */}
                {mode === "transportAdministrator" &&
                  trip.status === "Approved" && (
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onCompleteTrip?.(trip.id)}
                        className="h-8 rounded-md bg-[#0F2747] px-3 text-xs font-medium text-white hover:bg-[#334E68]"
                      >
                        Mark Completed
                      </button>

                      <button
                        type="button"
                        onClick={() => onResetTripDecision?.(trip.id)}
                        className="text-xs font-medium text-[#334E68] hover:underline"
                      >
                        Undo decision
                      </button>
                    </div>
                  )}

                {mode === "transportAdministrator" &&
                  trip.status === "Rejected" && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => onResetTripDecision?.(trip.id)}
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
            );
          })}
        </div>
      </div>

      {/* Transport In Charge — forward / send back */}
      {mode === "transportInCharge" && (
        <div className="space-y-3 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[#334E68]">
              {canForward
                ? "Every trip has a vehicle assigned — ready to forward."
                : `${missingVehicle.length} trip(s) still need a vehicle before this can be forwarded.`}
            </p>

            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setShowSendBackToApplicant(true)}
                className="h-9 rounded-md border border-[#E2E8F0] bg-white px-4 text-sm font-medium text-[#B91C1C] hover:bg-[#FEF2F2]"
              >
                Send Back to Applicant
              </button>

              <button
                type="button"
                onClick={onForwardToAdministrator}
                disabled={!canForward}
                className="h-9 rounded-md bg-[#0F2747] px-4 text-sm font-medium text-white hover:bg-[#334E68] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Forward to Administrator
              </button>
            </div>
          </div>

          {showSendBackToApplicant && (
            <SendBackForm
              withReason
              reason={reason}
              onReasonChange={setReason}
              remarks={remarks}
              onRemarksChange={setRemarks}
              onCancel={() => setShowSendBackToApplicant(false)}
              onConfirm={() => {
                if (!remarks.trim()) return;
                onSendBackToApplicant?.(reason, remarks);
                setShowSendBackToApplicant(false);
                setRemarks("");
              }}
            />
          )}
        </div>
      )}

      {/* Transport Administrator — send back to Transport In Charge */}
      {mode === "transportAdministrator" && (
        <div className="space-y-3 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[#334E68]">
              Not right? Send the whole application back to Transport In
              Charge instead of deciding trip-by-trip.
            </p>

            <button
              type="button"
              onClick={() => setShowSendBackToTIC(true)}
              className="h-9 shrink-0 rounded-md border border-[#E2E8F0] bg-white px-4 text-sm font-medium text-[#B91C1C] hover:bg-[#FEF2F2]"
            >
              Send Back to Transport In Charge
            </button>
          </div>

          {showSendBackToTIC && (
            <SendBackForm
              withReason={false}
              remarks={remarks}
              onRemarksChange={setRemarks}
              onCancel={() => setShowSendBackToTIC(false)}
              onConfirm={() => {
                if (!remarks.trim()) return;
                onSendBackToTransportInCharge?.(remarks);
                setShowSendBackToTIC(false);
                setRemarks("");
              }}
            />
          )}
        </div>
      )}

      {/* Documents */}
      {mode !== "transportInCharge" && (
        <div className="border-t border-[#E2E8F0] pt-4">
          <p className="mb-2 text-sm font-medium text-[#1E293B]">Documents</p>

          {mode === "transportAdministrator" && (
            <>
              {slipsGeneratable ? (
                <button
                  type="button"
                  onClick={onGenerateConfirmationSlip}
                  className="mb-3 h-9 rounded-md border border-[#E2E8F0] px-3 text-sm font-medium text-[#334E68] hover:bg-[#F8FAFC]"
                >
                  Download Confirmation Slip
                </button>
              ) : (
                <p className="mb-3 text-sm text-[#64748B]">
                  Confirmation slip becomes available once at least one trip
                  is approved.
                </p>
              )}
            </>
          )}

          {dutySlipGroups.length === 0 ? (
            <p className="text-sm text-[#64748B]">
              No approved & allocated trips yet — duty slips become available
              once trips are approved.
            </p>
          ) : (
            <div className="space-y-2">
              {dutySlipGroups.map((group) => {
                const assignedDriver = driver.find(
                  (member) => member.id === group.driverId,
                );
                const history = getDutySlipHistory(
                  requisition.id,
                  group.driverId,
                  dutySlips,
                );
                const latestSlip = history[0];
                const stale = latestSlip
                  ? hasStaleVehicleAssignment(latestSlip, allocations)
                  : false;
                const olderSlips = history.slice(1);
                const historyOpen = !!expandedHistory[group.driverId];

                function handleGenerateClick() {
                  // §2.3 — regenerating replaces a slip a driver may
                  // already be holding a printed copy of; first-time
                  // generation has nothing to supersede, so only confirm
                  // when there's an existing slip.
                  if (
                    latestSlip &&
                    !window.confirm(
                      `${assignedDriver?.name ?? "This driver"} already has a duty slip. ` +
                        "Regenerating will mark the current one Superseded. Continue?",
                    )
                  ) {
                    return;
                  }
                  onGenerateDutySlip?.(group.driverId);
                }

                return (
                  <div
                    key={group.driverId}
                    className="rounded-md border border-[#E2E8F0] px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
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
                              stale
                                ? "bg-[#FEF3C7] text-[#92400E]"
                                : "bg-[#DCFCE7] text-[#15803D]"
                            }`}
                          >
                            {stale ? "Vehicle changed — regenerate" : "Active"}
                          </span>
                        )}
                      </div>

                      {mode === "transportAdministrator" && (
                        <button
                          type="button"
                          onClick={handleGenerateClick}
                          className="h-8 rounded-md bg-[#0F2747] px-3 text-xs font-medium text-white hover:bg-[#334E68]"
                        >
                          {latestSlip
                            ? "Regenerate Duty Slip"
                            : "Generate Duty Slip"}
                        </button>
                      )}
                    </div>

                    {olderSlips.length > 0 && (
                      <div className="mt-2 border-t border-[#E2E8F0] pt-2">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedHistory((current) => ({
                              ...current,
                              [group.driverId]: !current[group.driverId],
                            }))
                          }
                          className="text-xs font-medium text-[#334E68] hover:underline"
                        >
                          {historyOpen ? "Hide" : "Show"} slip history (
                          {olderSlips.length} superseded)
                        </button>

                        {historyOpen && (
                          <ul className="mt-2 space-y-1">
                            {olderSlips.map((slip) => (
                              <li
                                key={slip.id}
                                className="flex items-center justify-between text-xs text-[#64748B]"
                              >
                                <span>
                                  Generated{" "}
                                  {new Date(slip.generatedAt).toLocaleString()}
                                </span>
                                <span className="inline-flex rounded-full bg-[#FEE2E2] px-2 py-0.5 font-medium text-[#B91C1C]">
                                  Superseded — see new slip
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {allocatingTrip && (
        <Modal
          title="Assign Vehicle"
          onClose={() => setAllocatingTrip(null)}
          wide
        >
          <AllocationPicker
            trip={allocatingTrip}
            allocations={allocations}
            excludeAllocationId={findAllocationForTrip(allocatingTrip.id)?.id}
            onSelect={handleVehicleSelected}
            onCancel={() => setAllocatingTrip(null)}
          />
        </Modal>
      )}
    </div>
  );
}

/**
 * Small shared form for the two "send the whole application back" flows.
 * `withReason` toggles the FRD-defined reason dropdown (used for
 * Transport In Charge → applicant, which reuses the recommender's
 * rejection-reason vocabulary); the Administrator → Transport In Charge
 * send-back is free-text remarks only, since the FRD doesn't define
 * fixed categories for that transition.
 */
function SendBackForm({
  withReason,
  reason,
  onReasonChange,
  remarks,
  onRemarksChange,
  onCancel,
  onConfirm,
}: {
  withReason: boolean;
  reason?: RejectionReason;
  onReasonChange?: (reason: RejectionReason) => void;
  remarks: string;
  onRemarksChange: (remarks: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-2 rounded-md border border-[#E2E8F0] bg-white p-3">
      {withReason && reason && onReasonChange && (
        <div>
          <label className="mb-1 block text-xs font-medium text-[#64748B]">
            Reason
          </label>

          <select
            value={reason}
            onChange={(event) =>
              onReasonChange(event.target.value as RejectionReason)
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
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-[#64748B]">
          Remarks (required)
        </label>

        <textarea
          value={remarks}
          onChange={(event) => onRemarksChange(event.target.value)}
          rows={2}
          className="w-full rounded-md border border-[#E2E8F0] px-3 py-2 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-8 rounded-md border border-[#E2E8F0] bg-white px-3 text-xs font-medium text-[#334E68] hover:bg-[#F8FAFC]"
        >
          Cancel
        </button>

        <button
          type="button"
          disabled={!remarks.trim()}
          onClick={onConfirm}
          className="h-8 rounded-md bg-[#B91C1C] px-3 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Confirm Send Back
        </button>
      </div>
    </div>
  );
}
