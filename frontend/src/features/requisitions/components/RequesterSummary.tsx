import type { Requisition, UserAccount } from "@/types";
import { RequisitionTypeBadge } from "@/shared/ui/StatusBadge";
import { formatDateRange } from "@/features/requisitions/utils/requisitionUtils";
import { SECTION_TITLE, SECTION_WRAP } from "./application/formTheme";

interface RequesterSummaryProps {
  requisition: Requisition;
  requester?: UserAccount;
}

export default function RequesterSummary({ requisition, requester }: RequesterSummaryProps) {
  return (
    <div className={SECTION_WRAP}>
      <h2 className={`${SECTION_TITLE} mb-3`}>Requester Information</h2>
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <div className="border-b border-form-rule pb-1.5">
          <p className="text-xs font-medium text-form-muted">Requester</p>
          <p className="text-sm text-form-ink">{requisition.requesterName}</p>
        </div>

        <div className="border-b border-form-rule pb-1.5">
          <p className="text-xs font-medium text-form-muted">Type</p>
          <RequisitionTypeBadge type={requisition.requisitionType} />
        </div>

        {requisition.department && (
          <div className="border-b border-form-rule pb-1.5">
            <p className="text-xs font-medium text-form-muted">Department / Organization</p>
            <p className="text-sm text-form-ink">{requisition.department}</p>
          </div>
        )}

        {requisition.contactNumber && (
          <div className="border-b border-form-rule pb-1.5">
            <p className="text-xs font-medium text-form-muted">Contact</p>
            <p className="text-sm text-form-ink">{requisition.contactNumber}</p>
          </div>
        )}

        <div className="border-b border-form-rule pb-1.5">
          <p className="text-xs font-medium text-form-muted">Date Range</p>
          <p className="text-sm text-form-ink">
            {formatDateRange(requisition.startDate, requisition.endDate)}
          </p>
        </div>

        <div className="border-b border-form-rule pb-1.5">
          <p className="text-xs font-medium text-form-muted">Schedule Type</p>
          <p className="text-sm text-form-ink">{requisition.scheduleType}</p>
        </div>

        <div className="sm:col-span-2 border-b border-form-rule pb-1.5">
          <p className="text-xs font-medium text-form-muted">Purpose</p>
          <p className="text-sm text-form-ink">{requisition.purpose}</p>
        </div>

        {requisition.supportingDocumentDataUrl && (
          <div className="sm:col-span-2 border-b border-form-rule pb-1.5">
            <p className="text-xs font-medium text-form-muted">Supporting Document</p>
            <a
              href={requisition.supportingDocumentDataUrl}
              target="_blank"
              rel="noreferrer"
              download={requisition.supportingDocumentName || undefined}
              className="text-sm font-medium text-primary hover:underline"
            >
              {requisition.supportingDocumentName || "View document"}
            </a>
          </div>
        )}

        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-form-rule pt-3 sm:col-span-2">
          <div className="border-b border-form-rule pb-1.5">
            <p className="text-xs font-medium text-form-muted">Signature</p>
            {requester?.signatureDataUrl ? (
              <img
                src={requester.signatureDataUrl}
                alt={`Signature of ${requisition.requesterName}`}
                className="mt-1 h-14 max-w-[220px] object-contain"
              />
            ) : (
              <p className="mt-1 text-sm italic text-form-muted">No signature on file</p>
            )}
          </div>
          <p className="text-xs text-form-muted">
            Submitted: {new Date(requisition.createdAt).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
