import { ApplicationStatusBadge, RequisitionTypeBadge } from "@/shared/ui/StatusBadge";
import {
  formatDateRange,
  getTripStatusCounts,
} from "@/features/requisitions/utils/requisitionUtils";
import {
  getMileageColumnStatus,
  type MileageTripContext,
} from "@/features/mileage/utils/mileageUtils";
import type { Allocation, MileageEntry, Requisition } from "@/types";

interface RequisitionsTableProps {
  requisitions: Requisition[];
  allocations: Allocation[];
  mileageEntries: MileageEntry[];
  allowMileageEntry: boolean;
  onView: (requisitionId: string) => void;
  onRecordMileage: (trips: MileageTripContext[]) => void;
}

export default function RequisitionsTable({
  requisitions,
  allocations,
  mileageEntries,
  allowMileageEntry,
  onView,
  onRecordMileage,
}: RequisitionsTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Requester</th>
              <th className="px-4 py-3 font-semibold">Purpose</th>
              <th className="px-4 py-3 font-semibold">Date Range</th>
              <th className="px-4 py-3 font-semibold">Trips</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Mileage</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requisitions.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <p className="font-medium text-text">No requisitions found</p>
                  <p className="mt-1 text-sm text-text-muted">Add a requisition to get started.</p>
                </td>
              </tr>
            ) : (
              requisitions.map((requisition, index) => {
                const counts = getTripStatusCounts(requisition.trips);
                const mileageStatus = getMileageColumnStatus(
                  requisition,
                  allocations,
                  mileageEntries,
                );

                return (
                  <tr
                    key={requisition.id}
                    className={`border-t border-border ${index % 2 === 1 ? "bg-surface" : "bg-white"}`}
                  >
                    <td className="px-4 py-3">
                      <RequisitionTypeBadge type={requisition.requisitionType} />
                    </td>
                    <td className="px-4 py-3 font-medium text-text">{requisition.requesterName}</td>
                    <td
                      className="max-w-xs truncate px-4 py-3 text-text-muted"
                      title={requisition.purpose}
                    >
                      {requisition.purpose}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {formatDateRange(requisition.startDate, requisition.endDate)}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {requisition.trips.length}
                      {counts.approved + counts.rejected > 0 && (
                        <span className="ml-1 text-xs text-form-placeholder">
                          ({counts.approved} approved, {counts.rejected} rejected)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ApplicationStatusBadge status={requisition.status} />
                    </td>
                    <td className="px-4 py-3">
                      {mileageStatus.kind === "not-applicable" && (
                        <span className="text-text-muted">—</span>
                      )}
                      {mileageStatus.kind === "not-ready" && (
                        <span
                          className="text-text-muted"
                          title="Approve and allocate a vehicle first"
                        >
                          —
                        </span>
                      )}
                      {mileageStatus.kind === "recorded" && (
                        <span className="font-medium text-success">
                          {mileageStatus.distanceKm} km
                        </span>
                      )}
                      {mileageStatus.kind === "awaiting" &&
                        (allowMileageEntry ? (
                          <button
                            type="button"
                            onClick={() => onRecordMileage(mileageStatus.trips)}
                            className="text-sm font-medium text-secondary hover:underline"
                          >
                            Record Mileage
                          </button>
                        ) : (
                          <span className="text-text-muted">Awaiting</span>
                        ))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onView(requisition.id)}
                        className="text-sm font-medium text-secondary hover:underline"
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
  );
}
