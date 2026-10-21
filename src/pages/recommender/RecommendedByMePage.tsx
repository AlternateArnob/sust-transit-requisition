import { useMemo } from "react";
import { Link, Navigate } from "react-router-dom";

import useAuth from "../../hooks/useAuth";
import useRequisitions from "../../hooks/useRequisitions";

import { formatDateRange } from "../../utils/requisitionUtils";
import DataTable from "../../components/DataTable";

import type { Requisition } from "../../types";

/**
 * "Recommended by me" — the Department Head's history of requisitions
 * they have cleared, with their optional message and where each one
 * stands now in the Transport Office. Requisitions recommended before
 * `recommenderId` existed are matched on the recommender's display name.
 */
export default function RecommendedByMePage() {
  const { currentUser } = useAuth();
  const { requisitions } = useRequisitions();

  const myName = currentUser?.fullName?.trim() || currentUser?.email || "";

  const rows: Requisition[] = useMemo(() => {
    if (!currentUser) return [];
    return requisitions
      .filter((requisition) =>
        requisition.recommenderId
          ? requisition.recommenderId === currentUser.id
          : Boolean(myName) &&
            requisition.recommenderName === myName &&
            requisition.status !== "Rejected" &&
            requisition.status !== "Pending Recommendation",
      )
      .sort((a, b) =>
        (b.recommendedAt ?? b.createdAt).localeCompare(
          a.recommendedAt ?? a.createdAt,
        ),
      );
  }, [requisitions, currentUser, myName]);

  if (!currentUser || currentUser.role !== "DepartmentHead") {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/admin/recommender"
          className="text-xs font-medium text-[#334E68] hover:underline"
        >
          ← Back to requests
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[#1E293B]">
          Recommended by me
        </h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Requisitions you have recommended to the Transport Office.
        </p>
      </div>

      <DataTable<Requisition>
        rowKey={(row) => row.id}
        emptyTitle="You haven't recommended any requisitions yet"
        emptyDescription="Requisitions you recommend will be listed here with their current status."
        columns={[
          { header: "Requester", render: (row) => row.requesterName },
          {
            header: "Department / Office",
            render: (row) => row.department ?? "—",
          },
          {
            header: "Date",
            render: (row) => formatDateRange(row.startDate, row.endDate),
          },
          {
            header: "Recommended on",
            render: (row) =>
              row.recommendedAt
                ? new Date(row.recommendedAt).toLocaleDateString()
                : "—",
          },
          {
            header: "Your message",
            render: (row) => row.recommenderMessage ?? "—",
          },
          {
            header: "Status",
            render: (row) => (
              <span className="inline-flex rounded-full bg-[#DBEAFE] px-2.5 py-1 text-xs font-medium text-[#0F2747]">
                {row.status}
              </span>
            ),
          },
          {
            header: "Action",
            align: "right",
            render: (row) => (
              <Link
                to={`/admin/recommender/${row.id}`}
                className="text-sm font-medium text-[#334E68] hover:underline"
              >
                View →
              </Link>
            ),
          },
        ]}
        rows={rows}
      />
    </div>
  );
}
