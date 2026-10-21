import { useState } from "react";

import Modal from "../Modal";
import Button from "../ui/Button";
import {
  REJECTION_REASONS,
  type RejectionReason,
} from "../../types";

interface RecommenderActionsProps {
  /**
   * The status the requisition currently sits in. We only render the
   * action bar when this is "Pending Recommendation" — for any other
   * status the recommender cannot act and the bar collapses to a
   * read-only notice.
   */
  status: string;
  recommenderName: string;
  /**
   * Returns true if the action is reachable for the current recommender.
   * The default implementation only blocks when there is no signed-in
   * recommender; tighter scoping (e.g. department match) is the caller's
   * responsibility.
   */
  isAssigned?: boolean;
  isSubmitting?: boolean;
  /** `message` is the optional note forwarded to the Transport Office. */
  onRecommend: (message: string) => void;
  onReject: (reason: RejectionReason, remarks: string) => void;
  onSendBack: (reason: RejectionReason, remarks: string) => void;
}

type DialogKind = "reject" | "send-back" | null;

function statusNotice(status: string): string {
  if (status === "Recommended") {
    return "You have already recommended this requisition. Admin is reviewing it now.";
  }
  if (status === "Rejected") {
    return "This requisition was rejected. The applicant has been notified.";
  }
  if (status === "Information Requested") {
    return "This requisition was sent back to the applicant. They can edit and resubmit.";
  }
  return "This requisition is no longer awaiting your recommendation.";
}

export default function RecommenderActions({
  status,
  recommenderName,
  isAssigned = true,
  isSubmitting,
  onRecommend,
  onReject,
  onSendBack,
}: RecommenderActionsProps) {
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [reason, setReason] = useState<RejectionReason>(REJECTION_REASONS[0]);
  const [remarks, setRemarks] = useState("");
  const [validation, setValidation] = useState<string | null>(null);
  const [recommendMessage, setRecommendMessage] = useState("");

  function openDialog(kind: Exclude<DialogKind, null>) {
    setDialog(kind);
    setReason(REJECTION_REASONS[0]);
    setRemarks("");
    setValidation(null);
  }

  function closeDialog() {
    setDialog(null);
    setValidation(null);
  }

  function confirm() {
    if (!dialog) return;
    if (!remarks.trim()) {
      setValidation("Please add a remark so the applicant knows what to fix.");
      return;
    }
    if (dialog === "reject") {
      onReject(reason, remarks.trim());
    } else {
      onSendBack(reason, remarks.trim());
    }
    closeDialog();
  }

  const dialogTitle =
    dialog === "reject" ? "Reject requisition" : "Send back to applicant";

  const dialogIntro =
    dialog === "reject"
      ? "The application will be closed. The applicant will see your reason."
      : "The applicant will see your remark and can edit & resubmit the requisition.";

  if (status !== "Pending Recommendation") {
    return (
      <div className="rounded-md border border-border bg-surface p-4 text-sm text-text-muted">
        {statusNotice(status)}
      </div>
    );
  }

  if (!isAssigned) {
    return (
      <div className="rounded-md border border-form-warn-border bg-form-warn-bg p-4 text-sm text-form-warn-text">
        You are signed in as a recommender but you are not assigned to the
        applicant&apos;s department. Contact the administrator if this looks
        wrong.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-surface p-4">
      <div>
        <p className="text-sm font-semibold text-text">
          Your decision
        </p>
        <p className="text-xs text-text-muted">
          Acting as {recommenderName || "Recommender"}. A reason is required
          for reject and send-back.
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-text">
          Message to Transport Office{" "}
          <span className="font-normal text-text-muted">(optional)</span>
        </label>
        <textarea
          value={recommendMessage}
          onChange={(event) => setRecommendMessage(event.target.value)}
          rows={2}
          placeholder="Only used if you recommend — e.g. why this trip is needed."
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-text outline-none placeholder:text-form-placeholder focus:border-secondary focus:ring-1 focus:ring-secondary"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="success"
          onClick={() => onRecommend(recommendMessage)}
          disabled={isSubmitting}
        >
          Recommend
        </Button>
        <Button
          variant="secondary"
          onClick={() => openDialog("send-back")}
          disabled={isSubmitting}
        >
          Send back to applicant
        </Button>
        <Button
          variant="danger"
          onClick={() => openDialog("reject")}
          disabled={isSubmitting}
        >
          Reject
        </Button>
      </div>

      {dialog ? (
        <Modal title={dialogTitle} onClose={closeDialog}>
          <div className="space-y-3">
            <p className="text-sm text-text-muted">{dialogIntro}</p>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">
                Reason
              </label>
              <select
                value={reason}
                onChange={(event) =>
                  setReason(event.target.value as RejectionReason)
                }
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-text outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
              >
                {REJECTION_REASONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">
                Remarks
              </label>
              <textarea
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                rows={3}
                placeholder="Add context for the applicant or the audit trail."
                className="w-full rounded-md border border-border px-3 py-2 text-sm text-text outline-none placeholder:text-text-muted focus:border-secondary focus:ring-1 focus:ring-secondary"
              />
            </div>

            {validation ? (
              <p className="text-xs text-error">{validation}</p>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={closeDialog}>
                Cancel
              </Button>
              <Button onClick={confirm} disabled={isSubmitting}>
                {dialog === "reject" ? "Reject requisition" : "Send back"}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
