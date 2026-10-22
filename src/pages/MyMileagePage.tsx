import { useMemo } from "react";
import { Navigate } from "react-router-dom";

import useAuth from "../hooks/useAuth";
import useRequisitions from "../hooks/useRequisitions";
import useAllocations from "../hooks/useAllocations";
import useVehicles from "../hooks/useVehicles";
import useMileageEntries from "../hooks/useMileageEntries";
import ApplicantHeader from "../components/ApplicantHeader";
import Card from "../components/ui/Card";
import DataTable from "../components/DataTable";
import PageTitle from "../components/ui/PageTitle";

import {
  getRecordedMileageTrips,
  isMileageEligibleRequisition,
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
  const { currentUser } = useAuth();
  const { requisitions } = useRequisitions();
  const { allocations } = useAllocations();
  const { vehicles } = useVehicles();
  const { mileageEntries } = useMileageEntries();

  const myPersonalTrips = useMemo(() => {
    if (!currentUser) return [];

    return getRecordedMileageTrips(requisitions, allocations, mileageEntries).filter(
      ({ requisition }) =>
        requisition.requesterId === currentUser.id &&
        // Phase 6 (admin module) — narrowed from "any Personal-type
        // requisition" to Teacher/Officer personal-use only, per FRD
        // §23's literal wording. A Student's Personal-use trips won't
        // show up here even though the requisition itself is allowed.
        isMileageEligibleRequisition(requisition),
    );
  }, [requisitions, allocations, mileageEntries, currentUser]);

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const totalKm = myPersonalTrips.reduce(
    (sum, item) => sum + item.entry.distanceKm,
    0,
  );

  return (
    <div className="min-h-screen bg-surface">
      <ApplicantHeader active="my-mileage" title="My Mileage" />

      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-6">
          <PageTitle
            title="Your personal trip mileage"
            subtitle="The Transport Office records the distance travelled after each personal-use trip. This page tracks the total across your history."
          />
        </div>

        <Card className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Total kilometres travelled
          </p>
          <p className="mt-2 text-3xl font-semibold text-text">
            {totalKm.toLocaleString()} km
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Across {myPersonalTrips.length} recorded personal trip
            {myPersonalTrips.length === 1 ? "" : "s"}
          </p>
        </Card>

        <DataTable
          rowKey={({ entry }) => entry.id}
          rows={myPersonalTrips}
          emptyTitle="No mileage recorded yet"
          emptyDescription="This fills in once the Transport Office records the distance for one of your personal-use trips."
          columns={[
            { header: "Date", render: ({ trip }) => trip.date },
            {
              header: "Route",
              render: ({ requisition, trip }) => (
                <span
                  className="block max-w-xs truncate"
                  title={`${requisition.id} · ${trip.route}`}
                >
                  {trip.route}
                </span>
              ),
            },
            {
              header: "Vehicle",
              render: ({ allocation }) => {
                const vehicle = vehicles.find(
                  (item) => item.id === allocation.vehicleId,
                );
                return vehicle
                  ? `${vehicle.registrationNumber} (${vehicle.category})`
                  : "—";
              },
            },
            {
              header: "Distance",
              align: "right",
              render: ({ entry }) => (
                <span className="font-medium">{entry.distanceKm} km</span>
              ),
            },
          ]}
        />
      </main>
    </div>
  );
}
