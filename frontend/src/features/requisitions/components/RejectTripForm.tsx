import { REJECTION_REASONS, type RejectionReason } from "@/types";
import { buttonClass } from "@/shared/ui/buttonStyles";

interface RejectTripFormProps {
  reason: RejectionReason;
  remarks: string;
  onReasonChange: (reason: RejectionReason) => void;
  onRemarksChange: (remarks: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function RejectTripForm({
  reason,
  remarks,
  onReasonChange,
  onRemarksChange,
  onCancel,
  onConfirm,
}: RejectTripFormProps) {
  return (
    <div className="mt-3 space-y-2 rounded-md border border-form-rule bg-surface p-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-form-muted">Rejection Reason</label>

        <select
          value={reason}
          onChange={(event) => onReasonChange(event.target.value as RejectionReason)}
          className="h-9 w-full rounded-md border border-form-rule bg-white px-3 text-sm text-form-ink outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
        >
          {REJECTION_REASONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-form-muted">Remarks (optional)</label>

        <input
          type="text"
          value={remarks}
          onChange={(event) => onRemarksChange(event.target.value)}
          className="h-9 w-full rounded-md border border-form-rule px-3 text-sm text-form-ink outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={buttonClass("secondary", "sm")}>
          Cancel
        </button>

        <button
          type="button"
          onClick={onConfirm}
          className="h-8 rounded-md bg-error px-3 text-xs font-medium text-white hover:opacity-90"
        >
          Confirm Reject
        </button>
      </div>
    </div>
  );
}
