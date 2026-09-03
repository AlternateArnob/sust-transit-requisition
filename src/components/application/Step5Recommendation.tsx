import type { ApplicantProfile, RequisitionType } from "../../types";
import type { JourneyDraft } from "./Step3Journey";
import type { TransportUserDraft } from "./Step2TransportUser";
import type { DetailsDraft } from "./Step4Details";

interface Step5RecommendationProps {
  requesterName: string;
  transportUser: TransportUserDraft;
  journey: JourneyDraft;
  details: DetailsDraft;
  applicantProfile: ApplicantProfile | undefined;
  requiresRecommendation: boolean;
  onSubmit: () => void;
  onSaveDraft: () => void;
  isSubmitting?: boolean;
}

function summaryRow(label: string, value: string) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] py-2 last:border-b-0">
      <span className="text-xs font-medium text-[#64748B]">{label}</span>
      <span className="max-w-[60%] text-right text-sm text-[#1E293B]">
        {value || "—"}
      </span>
    </div>
  );
}

function typeLabel(requisitionType: RequisitionType, requires: boolean) {
  if (requisitionType === "Official" && requires) {
    return `${requisitionType} (recommender review required)`;
  }
  return requisitionType;
}

export default function Step5Recommendation({
  requesterName,
  transportUser,
  journey,
  details,
  requiresRecommendation,
  onSubmit,
  onSaveDraft,
  isSubmitting,
}: Step5RecommendationProps) {
  const submitLabel = requiresRecommendation
    ? "Proceed to Recommendation"
    : "Submit Application";

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[#1E293B]">
          Step 5 — Review &amp; submit
        </h2>
        <p className="mt-1 text-sm text-[#64748B]">
          Review the summary below. You can save this as a draft to come back
          to later, or submit it now.
        </p>
      </div>

      <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-4">
        <p className="mb-2 text-sm font-semibold text-[#1E293B]">
          Requester
        </p>
        {summaryRow("Name", requesterName)}
        {summaryRow("Transport user", transportUser.fullName)}
        {summaryRow("Transport user mobile", transportUser.mobile)}
        {transportUser.designation
          ? summaryRow("Designation", transportUser.designation)
          : null}
      </div>

      <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-4">
        <p className="mb-2 text-sm font-semibold text-[#1E293B]">Journey</p>
        {summaryRow(
          "Requisition type",
          typeLabel(journey.requisitionType, requiresRecommendation),
        )}
        {summaryRow("Date", journey.date)}
        {summaryRow(
          "Time",
          journey.startTime && journey.endTime
            ? `${journey.startTime} → ${journey.endTime}`
            : "",
        )}
        {summaryRow("Destination", journey.destination)}
        {summaryRow("Purpose", journey.purpose)}
      </div>

      <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-4">
        <p className="mb-2 text-sm font-semibold text-[#1E293B]">Details</p>
        {summaryRow("Reason", details.reason)}
        {summaryRow(
          "Supporting document",
          details.supportingDocumentName || "Not provided",
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8F0] pt-4">
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={isSubmitting}
          className="h-10 rounded-md border border-[#E2E8F0] bg-white px-4 text-sm font-medium text-[#334E68] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:text-[#64748B]"
        >
          Save as Draft
        </button>

        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="h-10 rounded-md bg-[#0F2747] px-4 text-sm font-medium text-white hover:bg-[#334E68] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitLabel}
        </button>
      </div>
    </section>
  );
}
