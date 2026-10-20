import { useState } from "react";

import Modal from "../Modal";
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
  onRecommend: () => void;
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
      <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-sm text-[#64748B]">
        {statusNotice(status)}
      </div>
    );
  }

  if (!isAssigned) {
    return (
      <div className="rounded-md border border-[#FEF3C7] bg-[#FFFBEB] p-4 text-sm text-[#B45309]">
        You are signed in as a recommender but you are not assigned to the
        applicant&apos;s department. Contact the administrator if this looks
        wrong.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-4">
      <div>
        <p className="text-sm font-semibold text-[#1E293B]">
          Recommender actions
        </p>
        <p className="text-xs text-[#64748B]">
          Acting as {recommenderName || "Recommender"}. A reason is required
          for reject and send-back.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRecommend}
          disabled={isSubmitting}
          className="h-10 rounded-md bg-[#15803D] px-4 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          Recommend
        </button>
        <button
          type="button"
          onClick={() => openDialog("send-back")}
          disabled={isSubmitting}
          className="h-10 rounded-md border border-[#E2E8F0] bg-white px-4 text-sm font-medium text-[#334E68] hover:bg-white disabled:cursor-not-allowed disabled:text-[#64748B]"
        >
          Send back to applicant
        </button>
        <button
          type="button"
          onClick={() => openDialog("reject")}
          disabled={isSubmitting}
          className="h-10 rounded-md border border-[#FEE2E2] bg-white px-4 text-sm font-medium text-[#B91C1C] hover:bg-[#FEF2F2] disabled:cursor-not-allowed disabled:text-[#64748B]"
        >
          Reject
        </button>
      </div>

      {dialog ? (
        <Modal title={dialogTitle} onClose={closeDialog}>
          <div className="space-y-3">
            <p className="text-sm text-[#64748B]">{dialogIntro}</p>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
                Reason
              </label>
              <select
                value={reason}
                onChange={(event) =>
                  setReason(event.target.value as RejectionReason)
                }
                className="h-10 w-full rounded-md border border-[#E2E8F0] bg-white px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
              >
                {REJECTION_REASONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
                Remarks
              </label>
              <textarea
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                rows={3}
                placeholder="Add context for the applicant or the audit trail."
                className="w-full rounded-md border border-[#E2E8F0] px-3 py-2 text-sm text-[#1E293B] outline-none placeholder:text-[#64748B] focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
              />
            </div>

            {validation ? (
              <p className="text-xs text-[#B91C1C]">{validation}</p>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeDialog}
                className="h-10 rounded-md border border-[#E2E8F0] bg-white px-4 text-sm font-medium text-[#334E68] hover:bg-[#F8FAFC]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={isSubmitting}
                className="h-10 rounded-md bg-[#0F2747] px-4 text-sm font-medium text-white hover:bg-[#334E68] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {dialog === "reject" ? "Reject requisition" : "Send back"}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
