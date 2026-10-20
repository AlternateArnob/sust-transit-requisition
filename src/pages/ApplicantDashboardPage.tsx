import { useMemo } from "react";
import { Link, Navigate } from "react-router-dom";

import useAuth from "../hooks/useAuth";
import useRequisitions from "../hooks/useRequisitions";

import StatCard from "../components/StatCard";
import ApplicantHeader from "../components/ApplicantHeader";
import { formatDateRange, getTripStatusCounts } from "../utils/requisitionUtils";

import type { ApplicationStatus } from "../types";

function statusBadgeClass(status: ApplicationStatus) {
  if (status === "Approved") return "bg-[#DCFCE7] text-[#15803D]";
  if (status === "Completed") return "bg-[#CBD5E1] text-[#1E293B]";
  if (status === "Rejected") return "bg-[#FEE2E2] text-[#B91C1C]";
  if (status === "Information Requested") return "bg-[#FEF3C7] text-[#B45309]";
  if (status === "Partially Approved") return "bg-[#FEF3C7] text-[#B45309]";
  if (status === "Draft") return "bg-[#F1F5F9] text-[#64748B]";
  return "bg-[#DBEAFE] text-[#0F2747]";
}

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
    <div className="min-h-screen bg-[#F8FAFC]">
      <ApplicantHeader active="dashboard" />

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
        <div>
          <h2 className="text-2xl font-semibold text-[#1E293B]">
            Welcome{currentUser.fullName ? `, ${currentUser.fullName}` : ""}
          </h2>
          <p className="mt-1 text-sm text-[#64748B]">
            An overview of your transport requisitions —{" "}
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

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
          <div className="rounded-md border border-[#E2E8F0] bg-white px-4 py-3 text-sm text-[#1E293B]">
            You have {draftCount} draft{draftCount === 1 ? "" : "s"} waiting
            to be submitted.{" "}
            <Link
              to="/my-requisitions"
              className="font-medium text-[#0F2747] hover:underline"
            >
              Finish {draftCount === 1 ? "it" : "them"}
            </Link>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Link
            to="/apply"
            className="inline-flex h-10 items-center justify-center rounded-md bg-[#0F2747] px-4 text-sm font-medium text-white hover:bg-[#334E68]"
          >
            + New Requisition
          </Link>
          <Link
            to="/my-requisitions"
            className="inline-flex h-10 items-center justify-center rounded-md border border-[#E2E8F0] bg-white px-4 text-sm font-medium text-[#334E68] hover:bg-[#F8FAFC]"
          >
            View My Requisitions
          </Link>
        </div>

        <div className="rounded-lg border border-[#E2E8F0] bg-white">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
            <p className="text-sm font-medium text-[#1E293B]">
              Recent Requisitions
            </p>

            <Link
              to="/my-requisitions"
              className="text-xs font-medium text-[#334E68] hover:underline"
            >
              View all
            </Link>
          </div>

          <div className="divide-y divide-[#E2E8F0]">
            {recent.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[#64748B]">
                No requisitions yet.{" "}
                <Link
                  to="/apply"
                  className="font-medium text-[#334E68] hover:underline"
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
                      className="truncate text-sm font-medium text-[#1E293B]"
                      title={requisition.purpose}
                    >
                      {requisition.purpose || "—"}
                    </p>
                    <p className="mt-0.5 text-xs text-[#64748B]">
                      {formatDateRange(
                        requisition.startDate,
                        requisition.endDate,
                      )}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(
                      requisition.status,
                    )}`}
                  >
                    {requisition.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
