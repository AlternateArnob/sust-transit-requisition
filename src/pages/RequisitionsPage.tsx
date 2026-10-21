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
import { ApplicationStatusBadge, RequisitionTypeBadge } from "../components/ui/StatusBadge";
import RequisitionDetail from "../components/RequisitionDetail";
import MileageEntryForm from "../components/MileageEntryForm";

import {
  isInTransportInChargeQueue,
  isInTransportAdministratorQueue,
  isInActiveQueue,
  getTripStatusCounts,
  formatDateRange,
} from "../utils/requisitionUtils";
import { getEligibleDutySlipGroups, canGenerateSlips } from "../utils/dutySlipUtils";
import { reassignAllocation } from "../utils/allocationUtils";
import { generateConfirmationSlip } from "../utils/pdf/confirmationSlip";
import { generateDutySlipPdf } from "../utils/pdf/dutySlip";
import {
  getMileageColumnStatus,
  type MileageTripContext,
} from "../utils/mileageUtils";
import {
  isTransportInCharge,
  isTransportAdministrator,
  canRecordMileage,
} from "../utils/permissions";
import {
  findTransportInCharge,
  findTransportAdministrators,
  buildApplicantNotification,
  buildRequisitionNotifications,
} from "../utils/notificationUtils";

import type {
  Requisition,
  RejectionReason,
  RequisitionType,
} from "../types";
import { REQUISITION_TYPES } from "../types";
import PageTitle from "../components/ui/PageTitle";

type Tab = "queue" | "approved" | "rejected" | "all";
type Mode = "transportInCharge" | "transportAdministrator" | "viewOnly";
type TypeFilter = RequisitionType | "All";

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
  const { users, findById: findUserById } = useUsers();
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
    return true;
  });

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

  const tabs: [Tab, string][] = [
    ["queue", "Queue"],
    ["approved", "Approved"],
    ["rejected", "Rejected"],
    ["all", "All"],
  ];

  return (
    <div className="space-y-6">
      <PageTitle title="Requisitions" subtitle={<>{isTransportInCharge(currentUser?.role) &&
            "Assign vehicles to incoming requisitions and forward them for approval"}
          {isTransportAdministrator(currentUser?.role) &&
            "Review forwarded requisitions and approve or reject each trip"}
          {!isTransportInCharge(currentUser?.role) &&
            !isTransportAdministrator(currentUser?.role) &&
            "Oversight view of the transport requisition pipeline"}</>} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 border-b border-border">
          {tabs.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`px-4 py-2 text-sm font-medium ${
                tab === value
                  ? "border-b-2 border-primary text-primary"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "queue" && (
          <label className="flex items-center gap-2 text-sm text-text-muted">
            Type
            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(event.target.value as TypeFilter)
              }
              className="h-9 rounded-md border border-border bg-white px-2 text-sm text-text outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
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

      <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface text-xs uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Requester</th>
                <th className="px-4 py-3 font-semibold">Purpose</th>
                <th className="px-4 py-3 font-semibold">Date Range</th>
                <th className="px-4 py-3 font-semibold">Trips</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Mileage</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <p className="font-medium text-text">
                      No requisitions found
                    </p>
                    <p className="mt-1 text-sm text-text-muted">
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
                      className={`border-t border-border ${index % 2 === 1 ? "bg-surface" : "bg-white"}`}
                    >
                      <td className="px-4 py-3">
                        <RequisitionTypeBadge type={requisition.requisitionType} />
                      </td>
                      <td className="px-4 py-3 font-medium text-text">
                        {requisition.requesterName}
                      </td>
                      <td
                        className="max-w-xs truncate px-4 py-3 text-text-muted"
                        title={requisition.purpose}
                      >
                        {requisition.purpose}
                      </td>
                      <td className="px-4 py-3 text-text-muted">
                        {formatDateRange(
                          requisition.startDate,
                          requisition.endDate,
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-muted">
                        {requisition.trips.length}
                        {counts.approved + counts.rejected > 0 && (
                          <span className="ml-1 text-xs text-form-placeholder">
                            ({counts.approved} approved, {counts.rejected}{" "}
                            rejected)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ApplicationStatusBadge status={requisition.status} />
                      </td>
                      <td className="px-4 py-3">
                        {mileageStatus.kind === "not-applicable" && (
                          <span className="text-text-muted">—</span>
                        )}
                        {mileageStatus.kind === "not-ready" && (
                          <span
                            className="text-text-muted"
                            title="Approve and allocate a vehicle first"
                          >
                            —
                          </span>
                        )}
                        {mileageStatus.kind === "recorded" && (
                          <span className="font-medium text-success">
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
                              className="text-sm font-medium text-secondary hover:underline"
                            >
                              Record Mileage
                            </button>
                          ) : (
                            <span className="text-text-muted">Awaiting</span>
                          ))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedId(requisition.id)}
                          className="text-sm font-medium text-secondary hover:underline"
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
            requester={findUserById(selected.requesterId)}
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
