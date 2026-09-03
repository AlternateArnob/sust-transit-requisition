import { useState } from "react";

import useRequisitions from "../hooks/useRequisitions";
import useAllocations from "../hooks/useAllocations";
import useMileageEntries from "../hooks/useMileageEntries";
import useVehicles from "../hooks/useVehicles";

import Modal from "../components/Modal";
import MileageEntryForm from "../components/MileageEntryForm";

import {
  getTripsAwaitingMileage,
  getRecordedMileageTrips,
  type MileageTripContext,
} from "../utils/mileageUtils";

type Tab = "awaiting" | "recorded";

export default function MileagePage() {
  const { requisitions, markReadyForAccounts } = useRequisitions();
  const { allocations } = useAllocations();
  const { mileageEntries, addMileageEntry } = useMileageEntries();
  const { vehicles } = useVehicles();

  const [tab, setTab] = useState<Tab>("awaiting");
  const [target, setTarget] = useState<MileageTripContext | null>(null);

  const awaiting = getTripsAwaitingMileage(
    requisitions,
    allocations,
    mileageEntries,
  );
  const recorded = getRecordedMileageTrips(
    requisitions,
    allocations,
    mileageEntries,
  );

  function getVehicleLabel(vehicleId: string) {
    const vehicle = vehicles.find((item) => item.id === vehicleId);
    return vehicle
      ? `${vehicle.registrationNumber} (${vehicle.category})`
      : "Unknown Vehicle";
  }

  function handleRecord(distanceKm: number) {
    if (!target) {
      return;
    }

    addMileageEntry({
      id: crypto.randomUUID(),
      requisitionId: target.requisition.id,
      tripId: target.trip.id,
      distanceKm,
      recordedAt: new Date().toISOString(),
    });

    markReadyForAccounts(target.requisition.id);
    setTarget(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#1E293B]">Mileage</h1>

        <p className="mt-1 text-sm text-[#64748B]">
          Record distance travelled for approved personal-use requisitions
        </p>
      </div>

      <div className="flex gap-2 border-b border-[#E2E8F0]">
        <button
          type="button"
          onClick={() => setTab("awaiting")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "awaiting"
              ? "border-b-2 border-[#0F2747] text-[#0F2747]"
              : "text-[#64748B] hover:text-[#1E293B]"
          }`}
        >
          Awaiting Mileage ({awaiting.length})
        </button>

        <button
          type="button"
          onClick={() => setTab("recorded")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "recorded"
              ? "border-b-2 border-[#0F2747] text-[#0F2747]"
              : "text-[#64748B] hover:text-[#1E293B]"
          }`}
        >
          Recorded ({recorded.length})
        </button>
      </div>

      {tab === "awaiting" && (
        <div className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0F2747] text-white">
                <tr>
                  <th className="px-4 py-3 font-medium">Requester</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Vehicle</th>
                  <th className="px-4 py-3 font-medium">Route</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>

              <tbody>
                {awaiting.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <p className="font-medium text-[#1E293B]">
                        Nothing awaiting mileage
                      </p>

                      <p className="mt-1 text-sm text-[#64748B]">
                        Approved personal-use trips with an assigned vehicle
                        will show up here.
                      </p>
                    </td>
                  </tr>
                ) : (
                  awaiting.map(({ requisition, trip, allocation }, index) => (
                    <tr
                      key={trip.id}
                      className={`border-t border-[#E2E8F0] ${
                        index % 2 === 1 ? "bg-[#F8FAFC]" : "bg-white"
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-[#1E293B]">
                        {requisition.requesterName}
                      </td>

                      <td className="px-4 py-3 text-[#64748B]">{trip.date}</td>

                      <td className="px-4 py-3 text-[#64748B]">
                        {getVehicleLabel(allocation.vehicleId)}
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
                          onClick={() =>
                            setTarget({ requisition, trip, allocation })
                          }
                          className="text-sm font-medium text-[#334E68] hover:underline"
                        >
                          Record Mileage
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

      {tab === "recorded" && (
        <div className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0F2747] text-white">
                <tr>
                  <th className="px-4 py-3 font-medium">Requester</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Vehicle</th>
                  <th className="px-4 py-3 font-medium">Distance (km)</th>
                  <th className="px-4 py-3 font-medium">Recorded At</th>
                </tr>
              </thead>

              <tbody>
                {recorded.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <p className="font-medium text-[#1E293B]">
                        No mileage recorded yet
                      </p>
                    </td>
                  </tr>
                ) : (
                  recorded.map(
                    ({ requisition, trip, allocation, entry }, index) => (
                      <tr
                        key={entry.id}
                        className={`border-t border-[#E2E8F0] ${
                          index % 2 === 1 ? "bg-[#F8FAFC]" : "bg-white"
                        }`}
                      >
                        <td className="px-4 py-3 font-medium text-[#1E293B]">
                          {requisition.requesterName}
                        </td>

                        <td className="px-4 py-3 text-[#64748B]">
                          {trip.date}
                        </td>

                        <td className="px-4 py-3 text-[#64748B]">
                          {getVehicleLabel(allocation.vehicleId)}
                        </td>

                        <td className="px-4 py-3 text-[#64748B]">
                          {entry.distanceKm} km
                        </td>

                        <td className="px-4 py-3 text-[#64748B]">
                          {new Date(entry.recordedAt).toLocaleString()}
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {target && (
        <Modal title="Record Mileage" onClose={() => setTarget(null)}>
          <MileageEntryForm
            trip={target.trip}
            onSubmit={handleRecord}
            onCancel={() => setTarget(null)}
          />
        </Modal>
      )}
    </div>
  );
}
