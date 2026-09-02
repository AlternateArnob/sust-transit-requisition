import { useState } from "react";

import useRequisitions from "../hooks/useRequisitions";
import useAllocations from "../hooks/useAllocations";
import useVehicles from "../hooks/useVehicles";
import useStaff from "../hooks/useStaff";
import useDutySlips from "../hooks/useDutySlips";

import Modal from "../components/Modal";
import RequisitionDetail from "../components/RequisitionDetail";

import {
  isInActiveQueue,
  getTripStatusCounts,
  formatDateRange,
} from "../utils/requisitionUtils";
import { getEligibleDutySlipGroups } from "../utils/dutySlipUtils";
import { generateConfirmationSlip } from "../utils/pdf/confirmationSlip";
import { generateDutySlipPdf } from "../utils/pdf/dutySlip";

import type { ApplicationStatus } from "../types";

type Tab = "queue" | "approved" | "rejected" | "all";

function statusBadgeClass(status: ApplicationStatus) {
  if (status === "Approved") return "bg-[#DCFCE7] text-[#15803D]";
  if (status === "Ready for Accounts") return "bg-[#E2E8F0] text-[#334E68]";
  if (status === "Rejected") return "bg-[#FEE2E2] text-[#B91C1C]";
  if (status === "Partially Approved") return "bg-[#FEF3C7] text-[#B45309]";
  if (status === "Pending Approval") return "bg-[#EDE9FE] text-[#6D28D9]";
  return "bg-[#DBEAFE] text-[#0F2747]";
}

export default function RequisitionsPage() {
  const { requisitions, approveTrip, rejectTrip, resetTripDecision } =
    useRequisitions();
  const { allocations, addAllocation, updateAllocation, removeAllocation } =
    useAllocations();
  const { vehicles } = useVehicles();
  const { staff } = useStaff();
  const { dutySlips, addDutySlip } = useDutySlips();

  const [tab, setTab] = useState<Tab>("queue");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sorted = [...requisitions].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );

  const filtered = sorted.filter((requisition) => {
    if (tab === "queue") return isInActiveQueue(requisition);
    if (tab === "approved")
      return (
        requisition.status === "Approved" ||
        requisition.status === "Ready for Accounts"
      );
    if (tab === "rejected") return requisition.status === "Rejected";
    return true;
  });

  const selected = requisitions.find(
    (requisition) => requisition.id === selectedId,
  );

  function handleApproveTripWithVehicle(
    requisitionId: string,
    tripId: string,
    vehicleId: string,
    driverId?: string,
  ) {
    approveTrip(requisitionId, tripId);

    const trip = requisitions
      .find((requisition) => requisition.id === requisitionId)
      ?.trips.find((item) => item.id === tripId);

    if (!trip) {
      return;
    }

    addAllocation({
      id: crypto.randomUUID(),
      requisitionId,
      tripId,
      vehicleId,
      driverId,
      date: trip.date,
      startTime: trip.startTime,
      endTime: trip.endTime,
      allocatedAt: new Date().toISOString(),
    });
  }

  function handleReassignTrip(
    tripId: string,
    vehicleId: string,
    driverId?: string,
  ) {
    const allocation = allocations.find((item) => item.tripId === tripId);

    if (allocation) {
      updateAllocation({
        ...allocation,
        vehicleId,
        driverId,
        allocatedAt: new Date().toISOString(),
      });
    }
  }

  function handleResetTrip(requisitionId: string, tripId: string) {
    resetTripDecision(requisitionId, tripId);

    const allocation = allocations.find((item) => item.tripId === tripId);

    if (allocation) {
      removeAllocation(allocation.id);
    }
  }

  function handleGenerateConfirmationSlip() {
    if (!selected) return;
    generateConfirmationSlip(selected, allocations, vehicles, staff);
  }

  function handleGenerateDutySlip(driverId: string) {
    if (!selected) return;

    const group = getEligibleDutySlipGroups(selected, allocations).find(
      (item) => item.driverId === driverId,
    );
    const driver = staff.find((member) => member.id === driverId);

    if (!group || !driver) return;

    generateDutySlipPdf(selected, driver, group.trips, vehicles);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#1E293B]">Requisitions</h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Review, approve/reject, and allocate incoming transport requisitions
        </p>
      </div>

      <div className="flex gap-2 border-b border-[#E2E8F0]">
        {(
          [
            ["queue", "Queue"],
            ["approved", "Approved"],
            ["rejected", "Rejected"],
            ["all", "All"],
          ] as [Tab, string][]
        ).map(([value, label]) => (
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
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
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
                  return (
                    <tr
                      key={requisition.id}
                      className={`border-t border-[#E2E8F0] ${index % 2 === 1 ? "bg-[#F8FAFC]" : "bg-white"}`}
                    >
                      <td className="px-4 py-3 text-[#64748B]">
                        {requisition.requisitionType}
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
                        {requisition.trips.length} ({counts.approved}A /{" "}
                        {counts.rejected}R / {counts.pending}P)
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(requisition.status)}`}
                        >
                          {requisition.status}
                        </span>
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

      {selected && (
        <Modal
          title={`Requisition — ${selected.requesterName}`}
          onClose={() => setSelectedId(null)}
          wide
        >
          <RequisitionDetail
            requisition={selected}
            vehicles={vehicles}
            staff={staff}
            allocations={allocations}
            dutySlips={dutySlips}
            onApproveTripWithVehicle={handleApproveTripWithVehicle}
            onRejectTrip={rejectTrip}
            onResetTrip={handleResetTrip}
            onGenerateConfirmationSlip={handleGenerateConfirmationSlip}
            onGenerateDutySlip={handleGenerateDutySlip}
          />
        </Modal>
      )}
    </div>
  );
}
