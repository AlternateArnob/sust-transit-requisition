import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import useAuth from "../../hooks/useAuth";
import useNotifications from "../../hooks/useNotifications";
import useRequisitions from "../../hooks/useRequisitions";
import useUsers from "../../hooks/useUsers";

import RecommenderActions from "../../components/recommender/RecommenderActions";
import Card, { SectionHeading } from "../../components/ui/Card";
import PageTitle from "../../components/ui/PageTitle";
import { ApplicationStatusBadge, TripStatusBadge } from "../../components/ui/StatusBadge";

import {
  formatDateRange,
  getTripStatusCounts,
} from "../../utils/requisitionUtils";
import {
  buildApplicantNotification,
  buildRequisitionNotifications,
  findTransportInCharge,
} from "../../utils/notificationUtils";

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
  const { users } = useUsers();
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
      <div className="rounded-md border border-error-bg bg-error-bg/50 px-4 py-3 text-sm text-error">
        <p className="font-medium">Requisition not found.</p>
        <Link
          to="/admin/recommender"
          className="mt-2 inline-block text-xs font-medium text-secondary hover:underline"
        >
          ← Back to requests
        </Link>
      </div>
    );
  }

  const isAssigned = scopesMatch(requisition.department, currentUser);
  const recommenderName =
    currentUser.fullName?.trim() || currentUser.email || "Department Head";

  function handleRecommend(message: string) {
    if (!requisition) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      const trimmedMessage = message.trim();
      recommendRequisition(requisition.id, recommenderName, {
        recommenderId: currentUser!.id,
        message: trimmedMessage,
      });

      // Step 8 — a recommendation is the only event that unblocks
      // Transport In Charge: per the applicant-module clarification,
      // "Departmental/Official → Department/Office Head → if approved →
      // Transport Office". Only they need to know a new item just
      // landed in their queue; nobody else gets a fan-out ping for this.
      for (const notification of buildRequisitionNotifications(
        findTransportInCharge(users),
        {
          requisition,
          type: "New Requisition",
          message: `${requisition.requesterName}'s requisition was recommended by ${recommenderName} and is awaiting Transport Office review.${trimmedMessage ? ` Message: "${trimmedMessage}"` : ""}`,
        },
      )) {
        addNotification(notification);
      }

      addNotification(
        buildApplicantNotification(requisition, {
          type: "Recommendation",
          message: `Your requisition was recommended by ${recommenderName} and forwarded to the Transport Office.`,
        }),
      );

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

      // Step 8 — per the applicant-module clarification, a rejection at
      // this stage never reaches the Transport Office at all, not even
      // as a notification. Only the applicant is told.
      addNotification(
        buildApplicantNotification(requisition, {
          type: "Recommendation",
          message: `Your requisition was rejected by ${recommenderName}: ${reason}${remarks ? ` — ${remarks}` : ""}.`,
        }),
      );

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

      // Same reasoning as handleReject — the applicant hasn't even
      // cleared their Department/Office Head yet, so the Transport
      // Office has no business hearing about this at all.
      addNotification(
        buildApplicantNotification(requisition, {
          type: "Sent Back to Applicant",
          message: `Your requisition was sent back by ${recommenderName}: ${reason}${remarks ? ` — ${remarks}` : ""}.`,
        }),
      );

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
      <div>
        <Link
          to="/admin/recommender"
          className="text-xs font-medium text-primary hover:underline"
        >
          ← Back to requests
        </Link>
        <div className="mt-2">
          <PageTitle
            title={`Requisition ${requisition.id}`}
            subtitle={`Submitted by ${requisition.requesterName} on ${new Date(
              requisition.createdAt,
            ).toLocaleString()}`}
            actions={
              <Card className="px-4 py-2.5 text-xs text-text-muted">
                <p>
                  Status:{" "}
                  <ApplicationStatusBadge status={requisition.status} />
                </p>
                <p className="mt-1">
                  Scope:{" "}
                  <span className="font-medium text-text">
                    {isAssigned ? "Assigned to you" : "Other department"}
                  </span>
                </p>
              </Card>
            }
          />
        </div>
      </div>

      {requisition.recommenderMessage ? (
        <Card className="px-4 py-3 text-sm text-text">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Your message to the Transport Office
          </p>
          <p className="mt-1">{requisition.recommenderMessage}</p>
        </Card>
      ) : null}

      {actionError && (
        <div className="rounded-md border border-error-bg bg-error-bg/50 px-4 py-3 text-sm text-error">
          {actionError}
        </div>
      )}

      <Card>
        <SectionHeading>Journey summary</SectionHeading>
        <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">
              Type
            </dt>
            <dd className="mt-1 text-text">{requisition.requisitionType}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">
              Department / Office
            </dt>
            <dd className="mt-1 text-text">{requisition.department ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">
              Date range
            </dt>
            <dd className="mt-1 text-text">
              {formatDateRange(requisition.startDate, requisition.endDate)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">
              Trips
            </dt>
            <dd className="mt-1 text-text">
              {counts.pending} pending · {counts.approved} approved ·{" "}
              {counts.rejected} rejected
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-text-muted">
              Purpose
            </dt>
            <dd className="mt-1 text-text">{requisition.purpose}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <SectionHeading>Trips</SectionHeading>
        <ul className="mt-4 space-y-3">
          {requisition.trips.map((trip, index) => (
            <li
              key={trip.id ?? `${requisition.id}-${index}`}
              className="rounded-md border border-border p-4 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-text">
                  Trip {index + 1} · {trip.route}
                </p>
                <TripStatusBadge status={trip.status} />
              </div>
              <p className="mt-1 text-xs text-text-muted">
                {trip.date} · {trip.startTime}–{trip.endTime}
              </p>
              {trip.rejectionRemarks && (
                <p className="mt-2 text-xs text-error">
                  Previous recommender note: {trip.rejectionRemarks}
                </p>
              )}
            </li>
          ))}
        </ul>
      </Card>

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
