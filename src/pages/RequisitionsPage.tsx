import { useState } from "react";

import useAuth from "../hooks/useAuth";
import useRequisitions from "../hooks/useRequisitions";
import useAllocations from "../hooks/useAllocations";
import useVehicles from "../hooks/useVehicles";
import useDriver from "../hooks/useDriver";
import useDutySlips from "../hooks/useDutySlips";
import useMileageEntries from "../hooks/useMileageEntries";
import useUsers from "../hooks/useUsers";
import useNotifications from "../hooks/useNotifications";

import Modal from "../components/Modal";
import RequisitionDetail from "../components/RequisitionDetail";
import MileageEntryForm from "../components/MileageEntryForm";

import {
  isInTransportInChargeQueue,
  isInTransportAdministratorQueue,
  isInActiveQueue,
  getTripStatusCounts,
  formatDateRange,
  requisitionTypeBadgeClass,
} from "../utils/requisitionUtils";
import { getEligibleDutySlipGroups, canGenerateSlips } from "../utils/dutySlipUtils";
import { getAllocatedTrips, reassignAllocation } from "../utils/allocationUtils";
import { generateConfirmationSlip } from "../utils/pdf/confirmationSlip";
import { generateDutySlipPdf } from "../utils/pdf/dutySlip";
import {
  getMileageColumnStatus,
  type MileageTripContext,
} from "../utils/mileageUtils";
import {
  isTransportInCharge,
  isTransportAdministrator,
  isSuperAdmin,
  canRecordMileage,
} from "../utils/permissions";
import {
  findTransportInCharge,
  findTransportAdministrators,
  buildApplicantNotification,
  buildRequisitionNotifications,
} from "../utils/notificationUtils";

import type {
  ApplicationStatus,
  Requisition,
  RejectionReason,
  RequisitionType,
} from "../types";
import { REQUISITION_TYPES } from "../types";

type Tab = "queue" | "approved" | "rejected" | "all" | "allocated";
type Mode = "transportInCharge" | "transportAdministrator" | "viewOnly";
type TypeFilter = RequisitionType | "All";

function statusBadgeClass(status: ApplicationStatus) {
  if (status === "Approved") return "bg-[#DCFCE7] text-[#15803D]";
  if (status === "Completed") return "bg-[#CBD5E1] text-[#1E293B]";
  if (status === "Ready for Accounts") return "bg-[#E2E8F0] text-[#334E68]";
  if (status === "Rejected") return "bg-[#FEE2E2] text-[#B91C1C]";
  if (status === "Partially Approved") return "bg-[#FEF3C7] text-[#B45309]";
  if (status === "Pending Administrator") return "bg-[#EDE9FE] text-[#6D28D9]";
  if (status === "Pending on Transport Office")
    return "bg-[#DBEAFE] text-[#0F2747]";
  return "bg-[#DBEAFE] text-[#0F2747]";
}

export default function RequisitionsPage() {
  const { currentUser } = useAuth();
  const {
    requisitions,
    approveTrip,
    rejectTrip,
    resetTripDecision,
    forwardToAdministrator,
    sendBackToApplicant,
    sendBackToTransportInCharge,
    markReadyForAccounts,
    completeTrip,
  } = useRequisitions();
  const { allocations, addAllocation, removeAllocation } =
    useAllocations();
  const { vehicles } = useVehicles();
  const { driver } = useDriver();
  const { dutySlips, addDutySlip } = useDutySlips();
  const { mileageEntries, addMileageEntry } = useMileageEntries();
  const { users } = useUsers();
  const { addNotification } = useNotifications();

  const [tab, setTab] = useState<Tab>("queue");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mileageTarget, setMileageTarget] = useState<
    MileageTripContext[] | null
  >(null);

  /**
   * Phase 1 — which stage a requisition shows up in the "Queue" tab
   * under depends on who's looking: Transport In Charge only sees what's
   * waiting on them, Transport Administrator only sees what's been
   * forwarded to them, and Super Admin sees the whole active pipeline
   * (oversight, not action).
   */
  function isInRoleQueue(requisition: Requisition): boolean {
    if (isTransportInCharge(currentUser?.role)) {
      return isInTransportInChargeQueue(requisition);
    }
    if (isTransportAdministrator(currentUser?.role)) {
      return isInTransportAdministratorQueue(requisition);
    }
    return isInActiveQueue(requisition);
  }

  /** A requisition renders in an actionable mode only for the role whose
   *  stage it's actually in right now — everyone else (including the
   *  "other" admin role looking at an out-of-turn item) gets a
   *  read-only view. */
  function modeFor(requisition: Requisition): Mode {
    if (
      isTransportInCharge(currentUser?.role) &&
      isInTransportInChargeQueue(requisition)
    ) {
      return "transportInCharge";
    }
    if (
      isTransportAdministrator(currentUser?.role) &&
      isInTransportAdministratorQueue(requisition)
    ) {
      return "transportAdministrator";
    }
    return "viewOnly";
  }

  const sorted = [...requisitions].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );

  const filtered = sorted.filter((requisition) => {
    if (tab === "queue") {
      return (
        isInRoleQueue(requisition) &&
        (typeFilter === "All" || requisition.requisitionType === typeFilter)
      );
    }
    if (tab === "approved")
      return (
        requisition.status === "Approved" ||
        requisition.status === "Completed" ||
        requisition.status === "Ready for Accounts"
      );
    if (tab === "rejected") return requisition.status === "Rejected";
    if (tab === "allocated") return false; // handled by its own table below
    return true;
  });

  // Phase 4, decision C — the retired AllocationPage's one genuinely
  // useful piece (a cross-requisition "what's allocated right now"
  // view) lives here now, as a Super-Admin-only oversight tab. Read-only
  // by design: reassignment/removal happens through a requisition's own
  // detail view in whichever stage is actually allowed to touch it.
  const allocatedRows = getAllocatedTrips(requisitions, allocations);

  const selected = requisitions.find(
    (requisition) => requisition.id === selectedId,
  );
  const selectedMode = selected ? modeFor(selected) : "viewOnly";

  // --- Transport In Charge actions ------------------------------------

  function handleAssignVehicle(
    tripId: string,
    vehicleId: string,
    driverId?: string,
  ) {
    if (!selected) return;

    const trip = selected.trips.find((item) => item.id === tripId);
    if (!trip) return;

    const existing = allocations.find((item) => item.tripId === tripId);

    if (existing) {
      // Phase 8, §3 — new record, old one removed, instead of mutating
      // the same Allocation in place.
      removeAllocation(existing.id);
      addAllocation(reassignAllocation(existing, vehicleId, driverId));
      return;
    }

    addAllocation({
      id: crypto.randomUUID(),
      requisitionId: selected.id,
      tripId,
      vehicleId,
      driverId,
      date: trip.date,
      startTime: trip.startTime,
      endTime: trip.endTime,
      allocatedAt: new Date().toISOString(),
    });
  }

  function handleRemoveVehicleAssignment(tripId: string) {
    const allocation = allocations.find((item) => item.tripId === tripId);
    if (allocation) {
      removeAllocation(allocation.id);
    }
  }

  function handleForwardToAdministrator() {
    if (!selected) return;
    forwardToAdministrator(selected.id);

    buildRequisitionNotifications(findTransportAdministrators(users), {
      requisition: selected,
      type: "Forwarded to Administrator",
      message: `${selected.requesterName}'s requisition has a vehicle assigned and is ready for your decision.`,
    }).forEach(addNotification);
  }

  function removeAllocationsFor(requisition: Requisition) {
    const tripIds = new Set(requisition.trips.map((trip) => trip.id));
    allocations
      .filter((allocation) => tripIds.has(allocation.tripId))
      .forEach((allocation) => removeAllocation(allocation.id));
  }

  function handleSendBackToApplicant(reason: RejectionReason, remarks: string) {
    if (!selected) return;
    sendBackToApplicant(selected.id, reason, remarks);
    // The application is going back to square one for the applicant, so
    // any vehicle Transport In Charge had tentatively picked is released
    // rather than held against a requisition that's no longer active.
    removeAllocationsFor(selected);

    addNotification(
      buildApplicantNotification(selected, {
        type: "Sent Back to Applicant",
        message: `Your requisition was sent back by Transport In Charge: ${remarks}`,
      }),
    );
  }

  // --- Transport Administrator actions ---------------------------------

  function handleApproveTrip(tripId: string) {
    if (!selected) return;
    approveTrip(selected.id, tripId);

    addNotification(
      buildApplicantNotification(selected, {
        type: "Trip Approved",
        message: "One of your trips was approved.",
      }),
    );
  }

  function handleRejectTrip(
    tripId: string,
    reason: RejectionReason,
    remarks?: string,
  ) {
    if (!selected) return;
    rejectTrip(selected.id, tripId, reason, remarks);

    // A rejected trip won't happen, so free the vehicle slot Transport
    // In Charge reserved for it instead of holding it indefinitely.
    const allocation = allocations.find((item) => item.tripId === tripId);
    if (allocation) {
      removeAllocation(allocation.id);
    }

    addNotification(
      buildApplicantNotification(selected, {
        type: "Trip Rejected",
        message: `One of your trips was rejected — ${reason}${remarks ? `: ${remarks}` : ""}.`,
      }),
    );
  }

  function handleResetTrip(tripId: string) {
    if (!selected) return;
    // Deliberately does NOT touch the allocation — undoing an
    // approve/reject call should let the Administrator re-decide using
    // the same Transport-In-Charge-assigned vehicle, not force a redo of
    // the vehicle pick too.
    resetTripDecision(selected.id, tripId);
  }

  /**
   * Phase 6 (FRD §22) — Transport Office marks an approved trip
   * Completed once it's actually happened. Deliberately does not touch
   * mileage or the allocation — those are separate facts (§22: "stored
   * separately"), untouched here.
   */
  function handleCompleteTrip(tripId: string) {
    if (!selected) return;
    completeTrip(selected.id, tripId);
  }

  function handleSendBackToTransportInCharge(remarks: string) {
    if (!selected) return;
    sendBackToTransportInCharge(selected.id, remarks);
    // Every trip decision is being reset, so any vehicle assignment
    // needs Transport In Charge to reconsider it too.
    removeAllocationsFor(selected);

    buildRequisitionNotifications(findTransportInCharge(users), {
      requisition: selected,
      type: "Sent Back to Transport In Charge",
      message: `Transport Administrator sent this requisition back: ${remarks}`,
    }).forEach(addNotification);
  }

  function handleGenerateConfirmationSlip() {
    if (!selected) return;

    // §2.1 — mirror the same conditions RequisitionDetail uses to decide
    // whether to even show the button, so the guarantee holds here too
    // instead of relying solely on the UI hiding it.
    if (modeFor(selected) !== "transportAdministrator") return;
    if (!canGenerateSlips(selected)) return;

    generateConfirmationSlip(selected, allocations, vehicles, driver);
  }

  function handleGenerateDutySlip(driverId: string) {
    if (!selected) return;
    if (modeFor(selected) !== "transportAdministrator") return;

    const group = getEligibleDutySlipGroups(selected, allocations).find(
      (item) => item.driverId === driverId,
    );
    const driverMember = driver.find((member) => member.id === driverId);

    if (!group || !driverMember) return;

    generateDutySlipPdf(selected, driverMember, group.trips, vehicles);

    addDutySlip({
      id: crypto.randomUUID(),
      requisitionId: selected.id,
      driverId,
      trips: group.trips.map(({ trip, allocation }) => ({
        tripId: trip.id,
        vehicleId: allocation.vehicleId,
      })),
      generatedAt: new Date().toISOString(),
    });
  }

  // --- Mileage (Phase 6 groundwork, unaffected by the role split) -----

  function handleRecordMileage(tripId: string, distanceKm: number) {
    if (!mileageTarget || mileageTarget.length === 0) {
      return;
    }

    const context = mileageTarget.find((item) => item.trip.id === tripId);
    if (!context) {
      return;
    }

    addMileageEntry({
      id: crypto.randomUUID(),
      requisitionId: context.requisition.id,
      tripId,
      distanceKm,
      recordedAt: new Date().toISOString(),
    });

    const remaining = mileageTarget.filter((item) => item.trip.id !== tripId);
    if (remaining.length === 0) {
      markReadyForAccounts(context.requisition.id);
    }

    setMileageTarget(null);
  }

  const allowMileageEntry = canRecordMileage(currentUser?.role);

  function getVehicleLabel(vehicleId: string) {
    const vehicle = vehicles.find((item) => item.id === vehicleId);
    return vehicle
      ? `${vehicle.registrationNumber} (${vehicle.category})`
      : "Unknown Vehicle";
  }

  function getDriverName(driverId?: string) {
    if (!driverId) {
      return "No driver";
    }

    return (
      driver.find((member) => member.id === driverId)?.name ?? "Unknown Driver"
    );
  }

  const tabs: [Tab, string][] = [
    ["queue", "Queue"],
    ["approved", "Approved"],
    ["rejected", "Rejected"],
    ["all", "All"],
  ];

  // Phase 4, decision C — oversight-only, so only Super Admin gets it.
  if (isSuperAdmin(currentUser?.role)) {
    tabs.push(["allocated", `Allocated (${allocatedRows.length})`]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#1E293B]">Requisitions</h1>
        <p className="mt-1 text-sm text-[#64748B]">
          {isTransportInCharge(currentUser?.role) &&
            "Assign vehicles to incoming requisitions and forward them for approval"}
          {isTransportAdministrator(currentUser?.role) &&
            "Review forwarded requisitions and approve or reject each trip"}
          {!isTransportInCharge(currentUser?.role) &&
            !isTransportAdministrator(currentUser?.role) &&
            "Oversight view of the transport requisition pipeline"}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 border-b border-[#E2E8F0]">
          {tabs.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`px-4 py-2 text-sm font-medium ${
                tab === value
                  ? "border-b-2 border-[#0F2747] text-[#0F2747]"
                  : "text-[#64748B] hover:text-[#1E293B]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "queue" && (
          <label className="flex items-center gap-2 text-sm text-[#64748B]">
            Type
            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(event.target.value as TypeFilter)
              }
              className="h-9 rounded-md border border-[#E2E8F0] bg-white px-2 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
            >
              <option value="All">All Types</option>
              {REQUISITION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {tab === "allocated" ? (
        <div className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0F2747] text-white">
                <tr>
                  <th className="px-4 py-3 font-medium">Requester</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Vehicle</th>
                  <th className="px-4 py-3 font-medium">Driver</th>
                </tr>
              </thead>
              <tbody>
                {allocatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <p className="font-medium text-[#1E293B]">
                        No allocations yet
                      </p>
                    </td>
                  </tr>
                ) : (
                  allocatedRows.map(({ requisition, allocation }, index) => (
                    <tr
                      key={allocation.id}
                      className={`border-t border-[#E2E8F0] ${
                        index % 2 === 1 ? "bg-[#F8FAFC]" : "bg-white"
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-[#1E293B]">
                        {requisition.requesterName}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${requisitionTypeBadgeClass(requisition.requisitionType)}`}
                        >
                          {requisition.requisitionType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">
                        {allocation.date}
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">
                        {allocation.startTime}–{allocation.endTime}
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">
                        {getVehicleLabel(allocation.vehicleId)}
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">
                        {getDriverName(allocation.driverId)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
      <div className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#0F2747] text-white">
              <tr>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Requester</th>
                <th className="px-4 py-3 font-medium">Purpose</th>
                <th className="px-4 py-3 font-medium">Date Range</th>
                <th className="px-4 py-3 font-medium">Trips</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Mileage</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <p className="font-medium text-[#1E293B]">
                      No requisitions found
                    </p>
                    <p className="mt-1 text-sm text-[#64748B]">
                      Add a requisition to get started.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((requisition, index) => {
                  const counts = getTripStatusCounts(requisition.trips);
                  const mileageStatus = getMileageColumnStatus(
                    requisition,
                    allocations,
                    mileageEntries,
                  );

                  return (
                    <tr
                      key={requisition.id}
                      className={`border-t border-[#E2E8F0] ${index % 2 === 1 ? "bg-[#F8FAFC]" : "bg-white"}`}
                    >
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${requisitionTypeBadgeClass(requisition.requisitionType)}`}
                        >
                          {requisition.requisitionType}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-[#1E293B]">
                        {requisition.requesterName}
                      </td>
                      <td
                        className="max-w-xs truncate px-4 py-3 text-[#64748B]"
                        title={requisition.purpose}
                      >
                        {requisition.purpose}
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">
                        {formatDateRange(
                          requisition.startDate,
                          requisition.endDate,
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">
                        {requisition.trips.length}
                        {counts.approved + counts.rejected > 0 && (
                          <span className="ml-1 text-xs text-[#94A3B8]">
                            ({counts.approved} approved, {counts.rejected}{" "}
                            rejected)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(requisition.status)}`}
                        >
                          {requisition.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {mileageStatus.kind === "not-applicable" && (
                          <span className="text-[#64748B]">—</span>
                        )}
                        {mileageStatus.kind === "not-ready" && (
                          <span
                            className="text-[#64748B]"
                            title="Approve and allocate a vehicle first"
                          >
                            —
                          </span>
                        )}
                        {mileageStatus.kind === "recorded" && (
                          <span className="font-medium text-[#15803D]">
                            {mileageStatus.distanceKm} km
                          </span>
                        )}
                        {mileageStatus.kind === "awaiting" &&
                          (allowMileageEntry ? (
                            <button
                              type="button"
                              onClick={() =>
                                setMileageTarget(mileageStatus.trips)
                              }
                              className="text-sm font-medium text-[#334E68] hover:underline"
                            >
                              Record Mileage
                            </button>
                          ) : (
                            <span className="text-[#64748B]">Awaiting</span>
                          ))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedId(requisition.id)}
                          className="text-sm font-medium text-[#334E68] hover:underline"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {selected && (
        <Modal
          title={`Requisition — ${selected.requesterName}`}
          onClose={() => setSelectedId(null)}
          wide
        >
          <RequisitionDetail
            requisition={selected}
            vehicles={vehicles}
            driver={driver}
            allocations={allocations}
            dutySlips={dutySlips}
            mode={selectedMode}
            onAssignVehicle={handleAssignVehicle}
            onRemoveVehicleAssignment={handleRemoveVehicleAssignment}
            onForwardToAdministrator={handleForwardToAdministrator}
            onSendBackToApplicant={handleSendBackToApplicant}
            onApproveTrip={handleApproveTrip}
            onRejectTrip={handleRejectTrip}
            onResetTripDecision={handleResetTrip}
            onSendBackToTransportInCharge={handleSendBackToTransportInCharge}
            onGenerateConfirmationSlip={handleGenerateConfirmationSlip}
            onGenerateDutySlip={handleGenerateDutySlip}
            onCompleteTrip={handleCompleteTrip}
          />
        </Modal>
      )}

      {mileageTarget && mileageTarget.length > 0 && (
        <Modal title="Record Mileage" onClose={() => setMileageTarget(null)}>
          <MileageEntryForm
            trips={mileageTarget.map((item) => item.trip)}
            onSubmit={handleRecordMileage}
            onCancel={() => setMileageTarget(null)}
          />
        </Modal>
      )}
    </div>
  );
}
