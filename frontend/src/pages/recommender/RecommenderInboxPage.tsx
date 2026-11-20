import { useMemo } from "react";
import { Link, Navigate } from "react-router-dom";

import useAuth from "../../hooks/useAuth";
import useRequisitions from "../../hooks/useRequisitions";

import {
  formatDateRange,
  getTripStatusCounts,
} from "../../utils/requisitionUtils";
import DataTable from "../../components/DataTable";
import Card from "../../components/ui/Card";
import PageTitle from "../../components/ui/PageTitle";
import StatusBadge from "../../components/ui/StatusBadge";

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

  const rows: Row[] = useMemo(() => {
    if (!currentUser) return [];
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

  // Only DepartmentHeads are routed here; double-check.
  if (!currentUser || currentUser.role !== "DepartmentHead") {
    return <Navigate to="/login" replace />;
  }

  const counts = {
    total: rows.length,
    assigned: rows.filter((row) => row.isAssigned).length,
  };

  return (
    <div className="space-y-6">
      <PageTitle
        title="Requests"
        subtitle="Review official requisitions awaiting your recommendation."
        actions={
          <Card className="px-4 py-2.5 text-xs text-text-muted">
            <Link
              to="/admin/recommender/history"
              className="mb-1 block font-medium text-primary hover:underline"
            >
              View requisitions I recommended →
            </Link>
            <p>
              <span className="font-semibold text-text">{counts.total}</span>{" "}
              pending ·{" "}
              <span className="font-semibold text-text">{counts.assigned}</span>{" "}
              assigned to you
            </p>
            <p className="mt-1">
              Scoped to department:{" "}
              <span className="font-medium text-text">
                {currentUser.headOfDepartment ||
                  currentUser.headOfOffice ||
                  "—"}
              </span>
            </p>
          </Card>
        }
      />

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
                <StatusBadge tone="success">Assigned</StatusBadge>
              ) : (
                <StatusBadge tone="warning">Other department</StatusBadge>
              ),
          },
          {
            header: "Action",
            align: "right",
            render: (row) => (
              <Link
                to={`/admin/recommender/${row.requisition.id}`}
                className="text-sm font-medium text-secondary hover:underline"
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
