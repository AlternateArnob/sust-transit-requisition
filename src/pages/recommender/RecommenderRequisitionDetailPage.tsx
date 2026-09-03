import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import useAuth from "../../hooks/useAuth";
import useNotifications from "../../hooks/useNotifications";
import useRequisitions from "../../hooks/useRequisitions";

import RecommenderActions from "../../components/recommender/RecommenderActions";

import {
  formatDateRange,
  getTripStatusCounts,
} from "../../utils/requisitionUtils";

import type { RejectionReason, UserAccount } from "../../types";

function scopesMatch(
  requesterDept: string | undefined,
  recommender: UserAccount,
): boolean {
  const department = requesterDept?.trim().toLowerCase();
  const headDept = recommender.headOfDepartment?.trim().toLowerCase();
  const headOffice = recommender.headOfOffice?.trim().toLowerCase();

  if (department && headDept && department === headDept) {
    return true;
  }
  if (department && headOffice && department === headOffice) {
    return true;
  }
  return false;
}

export default function RecommenderRequisitionDetailPage() {
  const { currentUser } = useAuth();
  const { requisitions, recommendRequisition, rejectRequisition, sendBackToApplicant } =
    useRequisitions();
  const { addNotification } = useNotifications();
  const { requisitionId } = useParams<{ requisitionId: string }>();
  const navigate = useNavigate();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const requisition = useMemo(
    () => requisitions.find((r) => r.id === requisitionId) ?? null,
    [requisitions, requisitionId],
  );

  if (!currentUser || currentUser.role !== "DepartmentHead") {
    return <Navigate to="/login" replace />;
  }

  if (!requisition) {
    return (
      <div className="rounded-md border border-[#FEE2E2] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">
        <p className="font-medium">Requisition not found.</p>
        <Link
          to="/admin/recommender"
          className="mt-2 inline-block text-xs font-medium text-[#334E68] hover:underline"
        >
          ← Back to inbox
        </Link>
      </div>
    );
  }

  const isAssigned = scopesMatch(requisition.department, currentUser);
  const recommenderName =
    currentUser.fullName?.trim() || currentUser.email || "Department Head";

  function handleRecommend() {
    if (!requisition) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      recommendRequisition(requisition.id, recommenderName);

      addNotification({
        id: crypto.randomUUID(),
        type: "New Requisition",
        message: `${requisition.requesterName}'s requisition ${requisition.id} recommended by ${recommenderName} is awaiting admin approval.`,
        timestamp: new Date().toISOString(),
        linkType: "requisition",
        linkId: requisition.id,
        isRead: false,
      });

      navigate("/admin/recommender");
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not recommend requisition.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReject(reason: RejectionReason, remarks: string) {
    if (!requisition) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      rejectRequisition(requisition.id, reason, remarks);
      addNotification({
        id: crypto.randomUUID(),
        type: "New Requisition",
        message: `${requisition.requesterName}'s requisition ${requisition.id} was rejected by ${recommenderName}: ${reason}. ${remarks}`,
        timestamp: new Date().toISOString(),
        linkType: "requisition",
        linkId: requisition.id,
        isRead: false,
      });
      navigate("/admin/recommender");
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not reject requisition.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSendBack(reason: RejectionReason, remarks: string) {
    if (!requisition) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      sendBackToApplicant(requisition.id, reason, remarks);
      addNotification({
        id: crypto.randomUUID(),
        type: "New Requisition",
        message: `${requisition.requesterName}'s requisition ${requisition.id} was sent back by ${recommenderName}: ${reason}. ${remarks}`,
        timestamp: new Date().toISOString(),
        linkType: "requisition",
        linkId: requisition.id,
        isRead: false,
      });
      navigate("/admin/recommender");
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Could not send back requisition.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const counts = getTripStatusCounts(requisition.trips);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/admin/recommender"
            className="text-xs font-medium text-[#334E68] hover:underline"
          >
            ← Back to inbox
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-[#1E293B]">
            Requisition {requisition.id}
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Submitted by {requisition.requesterName} on{" "}
            {new Date(requisition.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="rounded-md border border-[#E2E8F0] bg-white px-4 py-2 text-xs text-[#64748B]">
          <p>
            Status:{" "}
            <span className="font-medium text-[#1E293B]">
              {requisition.status}
            </span>
          </p>
          <p className="mt-1">
            Scope:{" "}
            <span className="font-medium text-[#1E293B]">
              {isAssigned ? "Assigned to you" : "Other department"}
            </span>
          </p>
        </div>
      </div>

      {actionError && (
        <div className="rounded-md border border-[#FEE2E2] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">
          {actionError}
        </div>
      )}

      <section className="rounded-lg border border-[#E2E8F0] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#64748B]">
          Journey summary
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-[#64748B]">
              Type
            </dt>
            <dd className="mt-1 text-[#1E293B]">{requisition.requisitionType}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[#64748B]">
              Department / Office
            </dt>
            <dd className="mt-1 text-[#1E293B]">{requisition.department ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[#64748B]">
              Date range
            </dt>
            <dd className="mt-1 text-[#1E293B]">
              {formatDateRange(requisition.startDate, requisition.endDate)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[#64748B]">
              Trips
            </dt>
            <dd className="mt-1 text-[#1E293B]">
              {counts.pending} pending · {counts.approved} approved ·{" "}
              {counts.rejected} rejected
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-[#64748B]">
              Purpose
            </dt>
            <dd className="mt-1 text-[#1E293B]">{requisition.purpose}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-[#E2E8F0] bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#64748B]">
          Trips
        </h2>
        <ul className="mt-4 space-y-3">
          {requisition.trips.map((trip, index) => (
            <li
              key={trip.id ?? `${requisition.id}-${index}`}
              className="rounded-md border border-[#E2E8F0] p-4 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-[#1E293B]">
                  Trip {index + 1} · {trip.route}
                </p>
                <span className="rounded-full bg-[#F8FAFC] px-2.5 py-1 text-xs text-[#64748B]">
                  {trip.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#64748B]">
                {trip.date} · {trip.startTime}–{trip.endTime}
              </p>
              {trip.rejectionRemarks && (
                <p className="mt-2 text-xs text-[#B91C1C]">
                  Previous recommender note: {trip.rejectionRemarks}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <RecommenderActions
        status={requisition.status}
        recommenderName={recommenderName}
        isAssigned={isAssigned}
        isSubmitting={isSubmitting}
        onRecommend={handleRecommend}
        onReject={handleReject}
        onSendBack={handleSendBack}
      />
    </div>
  );
}
