import { useMemo } from "react";
import { Link, Navigate } from "react-router-dom";

import useAuth from "../../hooks/useAuth";
import useRequisitions from "../../hooks/useRequisitions";

import {
  formatDateRange,
  getTripStatusCounts,
} from "../../utils/requisitionUtils";
import DataTable from "../../components/DataTable";

import type { Requisition, UserAccount } from "../../types";

interface Row {
  requisition: Requisition;
  isAssigned: boolean;
}

function scopesMatch(requester: Requisition, recommender: UserAccount): boolean {
  const department = requester.department?.trim().toLowerCase();
  const office = requester.department?.trim().toLowerCase();
  const headDept = recommender.headOfDepartment?.trim().toLowerCase();
  const headOffice = recommender.headOfOffice?.trim().toLowerCase();

  if (department && headDept && department === headDept) {
    return true;
  }
  if (office && headOffice && office === headOffice) {
    return true;
  }
  return false;
}

export default function RecommenderInboxPage() {
  const { currentUser } = useAuth();
  const { requisitions } = useRequisitions();

  // Only DepartmentHeads are routed here; double-check.
  if (!currentUser || currentUser.role !== "DepartmentHead") {
    return <Navigate to="/login" replace />;
  }

  const rows: Row[] = useMemo(() => {
    const pending = requisitions.filter(
      (requisition) => requisition.status === "Pending Recommendation",
    );

    const sorted = [...pending].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );

    return sorted.map((requisition) => ({
      requisition,
      isAssigned: scopesMatch(requisition, currentUser),
    }));
  }, [requisitions, currentUser]);

  const counts = {
    total: rows.length,
    assigned: rows.filter((row) => row.isAssigned).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#1E293B]">
            Recommender inbox
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Review official requisitions awaiting your recommendation.
          </p>
        </div>
        <div className="rounded-md border border-[#E2E8F0] bg-white px-4 py-2 text-xs text-[#64748B]">
          <p>
            <span className="font-semibold text-[#1E293B]">{counts.total}</span>{" "}
            pending ·{" "}
            <span className="font-semibold text-[#1E293B]">
              {counts.assigned}
            </span>{" "}
            assigned to you
          </p>
          <p className="mt-1">
            Scoped to department:{" "}
            <span className="font-medium text-[#1E293B]">
              {currentUser.headOfDepartment ||
                currentUser.headOfOffice ||
                "—"}
            </span>
          </p>
        </div>
      </div>

      <DataTable<Row>
        rowKey={(row) => row.requisition.id}
        emptyTitle="No requisitions awaiting your recommendation"
        emptyDescription="When applicants submit official requisitions from your department, they'll show up here."
        columns={[
          {
            header: "Type",
            render: (row) => row.requisition.requisitionType,
          },
          {
            header: "Requester",
            render: (row) => row.requisition.requesterName,
          },
          {
            header: "Department / Office",
            render: (row) => row.requisition.department ?? "—",
          },
          {
            header: "Date range",
            render: (row) =>
              formatDateRange(
                row.requisition.startDate,
                row.requisition.endDate,
              ),
          },
          {
            header: "Trips",
            render: (row) => {
              const counts = getTripStatusCounts(row.requisition.trips);
              return `${counts.pending} pending · ${counts.approved} approved · ${counts.rejected} rejected`;
            },
          },
          {
            header: "Scope",
            render: (row) =>
              row.isAssigned ? (
                <span className="inline-flex rounded-full bg-[#DCFCE7] px-2.5 py-1 text-xs font-medium text-[#15803D]">
                  Assigned
                </span>
              ) : (
                <span className="inline-flex rounded-full bg-[#FEF3C7] px-2.5 py-1 text-xs font-medium text-[#B45309]">
                  Other department
                </span>
              ),
          },
          {
            header: "Action",
            align: "right",
            render: (row) => (
              <Link
                to={`/admin/recommender/${row.requisition.id}`}
                className="text-sm font-medium text-[#334E68] hover:underline"
              >
                Review →
              </Link>
            ),
          },
        ]}
        rows={rows}
      />
    </div>
  );
}
