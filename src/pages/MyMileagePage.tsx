import { useMemo } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import useAuth from "../hooks/useAuth";
import useRequisitions from "../hooks/useRequisitions";
import useAllocations from "../hooks/useAllocations";
import useVehicles from "../hooks/useVehicles";
import useMileageEntries from "../hooks/useMileageEntries";

import {
  getRecordedMileageTrips,
  isPersonalUseRequisition,
} from "../utils/mileageUtils";

/**
 * Phase 7 — applicant-facing mileage log (spec §7).
 *
 * Since the driver never logs into the system, Admin records the actual
 * distance travelled against a requisition after the trip. This page
 * surfaces that recorded distance back to the applicant, scoped to their
 * own Personal-use trips only, plus a running total across their history.
 */
export default function MyMileagePage() {
  const { currentUser, logout } = useAuth();
  const { requisitions } = useRequisitions();
  const { allocations } = useAllocations();
  const { vehicles } = useVehicles();
  const { mileageEntries } = useMileageEntries();
  const navigate = useNavigate();

  const myPersonalTrips = useMemo(() => {
    if (!currentUser) return [];

    return getRecordedMileageTrips(requisitions, allocations, mileageEntries).filter(
      ({ requisition }) =>
        requisition.requesterId === currentUser.id &&
        isPersonalUseRequisition(requisition),
    );
  }, [requisitions, allocations, mileageEntries, currentUser]);

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const totalKm = myPersonalTrips.reduce(
    (sum, item) => sum + item.entry.distanceKm,
    0,
  );

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="flex h-16 items-center justify-between bg-[#0F2747] px-6 text-white">
        <h1 className="text-lg font-semibold">SUST Transit — My Mileage</h1>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/my-requisitions" className="hover:underline">
            My Requisitions
          </Link>
          <Link to="/apply" className="hover:underline">
            New Requisition
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md border border-white/30 px-3 py-1.5 hover:bg-white/10"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-[#1E293B]">
            Your personal trip mileage
          </h2>
          <p className="mt-1 text-sm text-[#64748B]">
            Admin records the distance travelled after each personal-use
            trip. This page tracks the total across your history.
          </p>
        </div>

        <div className="mb-6 rounded-lg border border-[#E2E8F0] bg-white p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
            Total kilometres travelled
          </p>
          <p className="mt-2 text-3xl font-semibold text-[#1E293B]">
            {totalKm.toLocaleString()} km
          </p>
          <p className="mt-1 text-xs text-[#64748B]">
            Across {myPersonalTrips.length} recorded personal trip
            {myPersonalTrips.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0F2747] text-white">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Route</th>
                  <th className="px-4 py-3 font-medium">Vehicle</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Distance
                  </th>
                </tr>
              </thead>
              <tbody>
                {myPersonalTrips.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center">
                      <p className="font-medium text-[#1E293B]">
                        No mileage recorded yet
                      </p>
                      <p className="mt-1 text-sm text-[#64748B]">
                        This fills in once Admin records the distance for one
                        of your personal-use trips.
                      </p>
                    </td>
                  </tr>
                ) : (
                  myPersonalTrips.map(
                    ({ requisition, trip, allocation, entry }, index) => {
                      const vehicle = vehicles.find(
                        (item) => item.id === allocation.vehicleId,
                      );

                      return (
                        <tr
                          key={entry.id}
                          className={`border-t border-[#E2E8F0] ${
                            index % 2 === 1 ? "bg-[#F8FAFC]" : "bg-white"
                          }`}
                        >
                          <td className="px-4 py-3 text-[#1E293B]">
                            {trip.date}
                          </td>
                          <td
                            className="max-w-xs truncate px-4 py-3 text-[#64748B]"
                            title={`${requisition.id} · ${trip.route}`}
                          >
                            {trip.route}
                          </td>
                          <td className="px-4 py-3 text-[#64748B]">
                            {vehicle
                              ? `${vehicle.registrationNumber} (${vehicle.category})`
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-[#1E293B]">
                            {entry.distanceKm} km
                          </td>
                        </tr>
                      );
                    },
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
