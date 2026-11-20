import { useMemo } from "react";
import { Link, Navigate } from "react-router-dom";

import useAuth from "../hooks/useAuth";
import useRequisitions from "../hooks/useRequisitions";

import StatCard from "../components/StatCard";
import ApplicantHeader from "../components/ApplicantHeader";
import Card from "../components/ui/Card";
import PageTitle from "../components/ui/PageTitle";
import { buttonClass } from "../components/ui/buttonStyles";
import { ApplicationStatusBadge } from "../components/ui/StatusBadge";
import { formatDateRange, getTripStatusCounts } from "../utils/requisitionUtils";

/**
 * Step 9 (applicant module) — the applicant's landing page after login,
 * replacing the old behavior of dropping straight onto the requisition
 * form. Matches the admin side's DashboardPage.tsx in spirit (stat cards
 * + a recent-activity panel) but scoped to just this applicant's own
 * requisitions (same `requesterId` filter MyRequisitionsPage.tsx uses)
 * and without any of the Transport Office-only concerns (vehicles,
 * drivers, conflicts) that page also covers.
 */
export default function ApplicantDashboardPage() {
  const { currentUser } = useAuth();
  const { requisitions } = useRequisitions();

  const myRequisitions = useMemo(() => {
    if (!currentUser) return [];
    return requisitions
      .filter((requisition) => requisition.requesterId === currentUser.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [requisitions, currentUser]);

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const allTrips = myRequisitions.flatMap((requisition) => requisition.trips);
  const tripCounts = getTripStatusCounts(allTrips);

  const draftCount = myRequisitions.filter(
    (requisition) => requisition.status === "Draft",
  ).length;

  const recent = myRequisitions.slice(0, 5);

  return (
    <div className="min-h-screen bg-surface">
      <ApplicantHeader active="dashboard" />

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
        <PageTitle
          title={`Welcome${currentUser.fullName ? `, ${currentUser.fullName}` : ""}`}
          subtitle={`An overview of your transport requisitions — ${new Date().toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}`}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Requisitions"
            value={myRequisitions.length}
            href="/my-requisitions"
          />
          <StatCard
            label="Pending Trips"
            value={tripCounts.pending}
            href="/my-requisitions"
            accent="warning"
          />
          <StatCard
            label="Approved Trips"
            value={tripCounts.approved}
            href="/my-requisitions"
            accent="success"
          />
          <StatCard
            label="Rejected Trips"
            value={tripCounts.rejected}
            href="/my-requisitions"
            accent={tripCounts.rejected > 0 ? "error" : "default"}
          />
        </div>

        {draftCount > 0 ? (
          <div className="rounded-md border border-border bg-white px-4 py-3 text-sm text-text">
            You have {draftCount} draft{draftCount === 1 ? "" : "s"} waiting
            to be submitted.{" "}
            <Link
              to="/my-requisitions"
              className="font-medium text-primary hover:underline"
            >
              Finish {draftCount === 1 ? "it" : "them"}
            </Link>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Link
            to="/apply"
            className={buttonClass("primary")}
          >
            + New Requisition
          </Link>
          <Link
            to="/my-requisitions"
            className={buttonClass("secondary")}
          >
            View My Requisitions
          </Link>
        </div>

        <Card flush>
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <p className="text-sm font-medium text-text">
              Recent Requisitions
            </p>

            <Link
              to="/my-requisitions"
              className="text-xs font-medium text-secondary hover:underline"
            >
              View all
            </Link>
          </div>

          <div className="divide-y divide-border">
            {recent.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-text-muted">
                No requisitions yet.{" "}
                <Link
                  to="/apply"
                  className="font-medium text-secondary hover:underline"
                >
                  Submit your first requisition
                </Link>
              </p>
            ) : (
              recent.map((requisition) => (
                <div
                  key={requisition.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p
                      className="truncate text-sm font-medium text-text"
                      title={requisition.purpose}
                    >
                      {requisition.purpose || "—"}
                    </p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {formatDateRange(
                        requisition.startDate,
                        requisition.endDate,
                      )}
                    </p>
                  </div>
                  <ApplicationStatusBadge status={requisition.status} />
                </div>
              ))
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}
