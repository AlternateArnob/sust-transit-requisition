import { REJECTION_REASONS, type RejectionReason } from "@/types";
import { buttonClass } from "@/shared/ui/buttonStyles";

/**
 * Small shared form for the two "send the whole application back" flows.
 * `withReason` toggles the FRD-defined reason dropdown (used for
 * Transport In Charge → applicant, which reuses the recommender's
 * rejection-reason vocabulary); the Administrator → Transport In Charge
 * send-back is free-text remarks only, since the FRD doesn't define
 * fixed categories for that transition.
 */
export default function SendBackForm({
  withReason,
  reason,
  onReasonChange,
  remarks,
  onRemarksChange,
  onCancel,
  onConfirm,
  noteOptional = false,
}: {
  noteOptional?: boolean;
  withReason: boolean;
  reason?: RejectionReason;
  onReasonChange?: (reason: RejectionReason) => void;
  remarks: string;
  onRemarksChange: (remarks: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-2 rounded-md border border-form-rule bg-white p-3">
      {withReason && reason && onReasonChange && (
        <div>
          <label className="mb-1 block text-xs font-medium text-form-muted">Reason</label>

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
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-form-muted">
          {noteOptional ? "Note to applicant (optional)" : "Remarks (required)"}
        </label>

        <textarea
          value={remarks}
          onChange={(event) => onRemarksChange(event.target.value)}
          rows={2}
          placeholder={noteOptional ? "Explain what the applicant should correct" : undefined}
          className="w-full rounded-md border border-form-rule px-3 py-2 text-sm text-form-ink outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={buttonClass("secondary", "sm")}>
          Cancel
        </button>

        <button
          type="button"
          disabled={!noteOptional && !remarks.trim()}
          onClick={onConfirm}
          className="h-8 rounded-md bg-error px-3 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Confirm Send Back
        </button>
      </div>
    </div>
  );
}
