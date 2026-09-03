import { useMemo, useState } from "react";

import Step1Requester from "./application/Step1Requester";
import Step2TransportUser, {
  type TransportUserDraft,
} from "./application/Step2TransportUser";
import Step3Journey, { type JourneyDraft } from "./application/Step3Journey";
import Step4Details, { type DetailsDraft } from "./application/Step4Details";

import useAuth from "../hooks/useAuth";
import useNotifications from "../hooks/useNotifications";
import useRequisitions from "../hooks/useRequisitions";
import useUsers from "../hooks/useUsers";
import { requiresRecommendation } from "../utils/authUtils";
import {
  buildRequisitionNotifications,
  findDepartmentHeadsForRequisition,
} from "../utils/notificationUtils";

import type { Requisition, Trip } from "../types";

interface RequisitionFormProps {
  onSubmit: (requisition: Requisition) => void;
  onCancel: () => void;
}

/**
 * Single-page applicant requisition form.
 *
 * All sections (requester, transport user, journey, details) are shown
 * together on one page — like the paper form it replaces — rather than
 * gated behind a multi-step wizard. Validation runs across every section
 * at once when the applicant submits or saves a draft, and any errors are
 * shown inline next to the relevant field plus summarised at the top.
 *
 * The legacy "paper form vs flexible multi-trip" branching from the
 * previous implementation is intentionally removed; that path was the
 * admin-only prototype and does not model this user journey.
 */
export default function RequisitionForm({
  onSubmit,
  onCancel,
}: RequisitionFormProps) {
  const { currentUser } = useAuth();
  const { addRequisition } = useRequisitions();
  const { addNotification } = useNotifications();
  const { users } = useUsers();

  const [sameAsRequester, setSameAsRequester] = useState(true);
  const [transportUser, setTransportUser] = useState<TransportUserDraft>({
    fullName: "",
    designation: "",
    mobile: "",
  });

  const [journey, setJourney] = useState<JourneyDraft>({
    date: "",
    startTime: "",
    endTime: "",
    destination: "",
    purpose: "",
    requisitionType: "Personal",
  });

  const [details, setDetails] = useState<DetailsDraft>({
    reason: "",
    supportingDocumentName: "",
    supportingDocumentDataUrl: undefined,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requester = currentUser;
  const requiresRecommender = useMemo(
    () =>
      requiresRecommendation(requester?.applicantProfile, journey.requisitionType),
    [requester?.applicantProfile, journey.requisitionType],
  );

  if (!requester) {
    return (
      <div className="rounded-md border border-[#FEE2E2] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">
        You must be signed in to apply for a vehicle. Please register or log in
        first.
      </div>
    );
  }

  function validateAll(): Record<string, string> {
    const next: Record<string, string> = {};

    if (!sameAsRequester) {
      if (!transportUser.fullName.trim()) {
        next.fullName = "Transport user name is required.";
      }
      if (!transportUser.mobile.trim()) {
        next.mobile = "Transport user mobile is required.";
      }
    }

    if (!journey.date) {
      next.date = "Date is required.";
    }
    if (!journey.startTime || !journey.endTime) {
      next.time = "Both From and To times are required.";
    }
    if (!journey.destination.trim()) {
      next.destination = "Destination is required.";
    }
    if (!journey.purpose.trim()) {
      next.purpose = "Purpose is required.";
    }

    if (!details.reason.trim()) {
      next.reason = "Reason for requisition is required.";
    }

    return next;
  }

  function buildTripFromJourney(): Trip {
    return {
      id: crypto.randomUUID(),
      date: journey.date,
      startTime: journey.startTime,
      endTime: journey.endTime,
      vehicleCategory: "Minibus",
      route: `Campus to ${journey.destination.trim()} and Return to Campus`,
      stoppageSequence: ["Campus", journey.destination.trim(), "Campus"],
      passengerGroups: [],
      status: "Pending",
    };
  }

  function buildRequisition(status: Requisition["status"]): Requisition {
    const trips = status === "Draft" ? [] : [buildTripFromJourney()];
    const departmentOrOffice = requester!.department ?? requester!.office ?? "";
    const contactNumber = requester!.mobile ?? transportUser.mobile;

    return {
      id: crypto.randomUUID(),
      requesterId: requester!.id,
      requesterName:
        requester!.fullName?.trim() || transportUser.fullName.trim() || requester!.email,
      applicantType: "Individual",
      department: departmentOrOffice.trim() || undefined,
      contactNumber: contactNumber?.trim() || undefined,
      requisitionType: journey.requisitionType,
      purpose: details.reason.trim() || journey.purpose.trim(),
      startDate: journey.date,
      endDate: journey.date,
      scheduleType: "Single",
      status,
      createdAt: new Date().toISOString(),
      trips,
    };
  }

  function handleSaveDraft() {
    setIsSubmitting(true);
    try {
      const draft = buildRequisition("Draft");
      addRequisition(draft);
      onSubmit(draft);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSubmit() {
    const next = validateAll();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setIsSubmitting(true);
    try {
      const finalStatus = requiresRecommender
        ? "Pending Recommendation"
        : "Pending Approval";

      const requisition = buildRequisition(finalStatus);
      addRequisition(requisition);
      onSubmit(requisition);

      // When the recommender workflow applies, notify every DepartmentHead
      // whose head-of-department / head-of-office matches this
      // requisition's department. The Admin notification is dispatched in
      // ApplyRequisitionPage after the requisition is added; here we only
      // handle the recommender audience, and each is stamped with that
      // user's id so useNotifications can filter per-recipient.
      if (requiresRecommender) {
        const heads = findDepartmentHeadsForRequisition(requisition, users);
        for (const notification of buildRequisitionNotifications(heads, {
          requisition,
          type: "New Requisition",
          message: `${requisition.requesterName} submitted an official requisition (${requisition.requisitionType.toLowerCase()}) awaiting your recommendation.`,
        })) {
          addNotification(notification);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const errorCount = Object.keys(errors).length;
  const submitLabel = requiresRecommender
    ? "Proceed to Recommendation"
    : "Submit Application";

  return (
    <div className="space-y-6">
      {errorCount > 0 ? (
        <div className="rounded-md border border-[#FEE2E2] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">
          Please fix {errorCount} field{errorCount === 1 ? "" : "s"} below
          before submitting.
        </div>
      ) : null}

      <FormSection first>
        <Step1Requester requester={requester} />
      </FormSection>

      <FormSection>
        <Step2TransportUser
          requester={requester}
          value={transportUser}
          sameAsRequester={sameAsRequester}
          onSameAsRequesterChange={setSameAsRequester}
          onChange={setTransportUser}
          errors={{
            fullName: errors.fullName,
            mobile: errors.mobile,
            designation: errors.designation,
          }}
        />
      </FormSection>

      <FormSection>
        <Step3Journey
          value={journey}
          onChange={setJourney}
          applicantProfile={requester.applicantProfile}
          errors={{
            date: errors.date,
            destination: errors.destination,
            purpose: errors.purpose,
          }}
        />
        {errors.time ? (
          <p className="-mt-2 text-xs text-[#B91C1C]">{errors.time}</p>
        ) : null}
      </FormSection>

      <FormSection>
        <Step4Details
          value={details}
          onChange={setDetails}
          errors={{ reason: errors.reason }}
        />
      </FormSection>

      {requiresRecommender ? (
        <p className="rounded-md border border-[#FEF3C7] bg-[#FEF3C7] px-4 py-3 text-sm text-[#B45309]">
          This requisition type requires your Department/Office Head to
          recommend it before Admin can review it.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8F0] pt-5">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 rounded-md border border-[#E2E8F0] bg-white px-4 text-sm font-medium text-[#334E68] hover:bg-[#F8FAFC]"
        >
          Cancel
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSubmitting}
            className="h-10 rounded-md border border-[#E2E8F0] bg-white px-4 text-sm font-medium text-[#334E68] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:text-[#64748B]"
          >
            Save as Draft
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="h-10 rounded-md bg-[#0F2747] px-4 text-sm font-medium text-white hover:bg-[#334E68] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Plain section divider — no boxes, no numbering, just one flowing sheet. */
function FormSection({
  first = false,
  children,
}: {
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={first ? "" : "border-t border-[#E2E8F0] pt-6"}>
      {children}
    </div>
  );
}
