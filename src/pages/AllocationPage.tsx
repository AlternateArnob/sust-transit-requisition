import { useState } from "react";

import useRequisitions from "../hooks/useRequisitions";
import useAllocations from "../hooks/useAllocations";
import useVehicles from "../hooks/useVehicles";
import useStaff from "../hooks/useStaff";

import Modal from "../components/Modal";
import AllocationPicker from "../components/AllocationPicker";

import {
  getApprovedTripsNeedingAllocation,
  getAllocatedTrips,
  type TripContext,
} from "../utils/allocationUtils";
import type { Allocation } from "../types";

type Tab = "pending" | "allocated";

type ReassignTarget = TripContext & { allocation: Allocation };

export default function AllocationPage() {
  const { requisitions } = useRequisitions();
  const { allocations, addAllocation, updateAllocation, removeAllocation } =
    useAllocations();
  const { vehicles } = useVehicles();
  const { staff } = useStaff();

  const [tab, setTab] = useState<Tab>("pending");
  const [pickerTarget, setPickerTarget] = useState<TripContext | null>(null);
  const [reassignTarget, setReassignTarget] = useState<ReassignTarget | null>(
    null,
  );

  const pendingQueue = getApprovedTripsNeedingAllocation(
    requisitions,
    allocations,
  );
  const allocatedList = getAllocatedTrips(requisitions, allocations);

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
      staff.find((member) => member.id === driverId)?.name ?? "Unknown Driver"
    );
  }

  function handleAllocate(vehicleId: string, driverId?: string) {
    if (!pickerTarget) {
      return;
    }

    const allocation: Allocation = {
      id: crypto.randomUUID(),
      requisitionId: pickerTarget.requisition.id,
      tripId: pickerTarget.trip.id,
      vehicleId,
      driverId,
      date: pickerTarget.trip.date,
      startTime: pickerTarget.trip.startTime,
      endTime: pickerTarget.trip.endTime,
      allocatedAt: new Date().toISOString(),
    };

    addAllocation(allocation);
    setPickerTarget(null);
  }

  function handleReassign(vehicleId: string, driverId?: string) {
    if (!reassignTarget) {
      return;
    }

    updateAllocation({
      ...reassignTarget.allocation,
      vehicleId,
      driverId,
      allocatedAt: new Date().toISOString(),
    });
    setReassignTarget(null);
  }

  function handleRemoveAllocation(allocationId: string) {
    const confirmed = window.confirm(
      "Remove this allocation? The trip will return to the pending queue.",
    );

    if (confirmed) {
      removeAllocation(allocationId);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#1E293B]">Allocation</h1>

        <p className="mt-1 text-sm text-[#64748B]">
          Assign vehicles to approved trips — drivers are auto-assigned from the
          vehicle's permanent pairing
        </p>
      </div>

      <div className="flex gap-2 border-b border-[#E2E8F0]">
        <button
          type="button"
          onClick={() => setTab("pending")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "pending"
              ? "border-b-2 border-[#0F2747] text-[#0F2747]"
              : "text-[#64748B] hover:text-[#1E293B]"
          }`}
        >
          Needs Allocation ({pendingQueue.length})
        </button>

        <button
          type="button"
          onClick={() => setTab("allocated")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "allocated"
              ? "border-b-2 border-[#0F2747] text-[#0F2747]"
              : "text-[#64748B] hover:text-[#1E293B]"
          }`}
        >
          Allocated ({allocatedList.length})
        </button>
      </div>

      {tab === "pending" && (
        <div className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0F2747] text-white">
                <tr>
                  <th className="px-4 py-3 font-medium">Requester</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Vehicle Category</th>
                  <th className="px-4 py-3 font-medium">Route</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>

              <tbody>
                {pendingQueue.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <p className="font-medium text-[#1E293B]">
                        Nothing waiting on allocation
                      </p>

                      <p className="mt-1 text-sm text-[#64748B]">
                        Approved trips without a vehicle will show up here.
                      </p>
                    </td>
                  </tr>
                ) : (
                  pendingQueue.map(({ requisition, trip }, index) => (
                    <tr
                      key={trip.id}
                      className={`border-t border-[#E2E8F0] ${
                        index % 2 === 1 ? "bg-[#F8FAFC]" : "bg-white"
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-[#1E293B]">
                        {requisition.requesterName}
                      </td>

                      <td className="px-4 py-3 text-[#64748B]">
                        {requisition.requisitionType}
                      </td>

                      <td className="px-4 py-3 text-[#64748B]">{trip.date}</td>

                      <td className="px-4 py-3 text-[#64748B]">
                        {trip.startTime}–{trip.endTime}
                      </td>

                      <td className="px-4 py-3 text-[#64748B]">
                        {trip.vehicleCategory}
                      </td>

                      <td
                        className="max-w-xs truncate px-4 py-3 text-[#64748B]"
                        title={trip.route}
                      >
                        {trip.route}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setPickerTarget({ requisition, trip })}
                          className="text-sm font-medium text-[#334E68] hover:underline"
                        >
                          Allocate
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "allocated" && (
        <div className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0F2747] text-white">
                <tr>
                  <th className="px-4 py-3 font-medium">Requester</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Vehicle</th>
                  <th className="px-4 py-3 font-medium">Driver</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>

              <tbody>
                {allocatedList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <p className="font-medium text-[#1E293B]">
                        No allocations yet
                      </p>
                    </td>
                  </tr>
                ) : (
                  allocatedList.map(({ requisition, allocation }, index) => (
                    <tr
                      key={allocation.id}
                      className={`border-t border-[#E2E8F0] ${
                        index % 2 === 1 ? "bg-[#F8FAFC]" : "bg-white"
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-[#1E293B]">
                        {requisition.requesterName}
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

                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setReassignTarget({
                                requisition,
                                trip: requisition.trips.find(
                                  (item) => item.id === allocation.tripId,
                                )!,
                                allocation,
                              })
                            }
                            className="text-sm font-medium text-[#334E68] hover:underline"
                          >
                            Reassign
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveAllocation(allocation.id)
                            }
                            className="text-sm font-medium text-[#B91C1C] hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pickerTarget && (
        <Modal
          title="Allocate Vehicle"
          onClose={() => setPickerTarget(null)}
          wide
        >
          <AllocationPicker
            trip={pickerTarget.trip}
            allocations={allocations}
            onSelect={handleAllocate}
            onCancel={() => setPickerTarget(null)}
          />
        </Modal>
      )}

      {reassignTarget && (
        <Modal
          title="Reassign Vehicle"
          onClose={() => setReassignTarget(null)}
          wide
        >
          <AllocationPicker
            trip={reassignTarget.trip}
            allocations={allocations}
            excludeAllocationId={reassignTarget.allocation.id}
            onSelect={handleReassign}
            onCancel={() => setReassignTarget(null)}
          />
        </Modal>
      )}
    </div>
  );
}
