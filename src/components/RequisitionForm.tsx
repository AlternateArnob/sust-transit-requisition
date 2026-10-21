import { useMemo, useState } from "react";

import sustLogo from "../assets/sust-logo.png";
import Step1Requester from "./application/Step1Requester";
import Step2TransportUser, {
  type TransportUserDraft,
} from "./application/Step2TransportUser";
import Step3Journey from "./application/Step3Journey";
import Step4Details, { type DetailsDraft } from "./application/Step4Details";
import { ERROR_TEXT, PART_LABEL, SECTION_TITLE, SECTION_WRAP } from "./application/formTheme";

import useAuth from "../hooks/useAuth";
import useNotifications from "../hooks/useNotifications";
import useUsers from "../hooks/useUsers";
import useRequisitions from "../hooks/useRequisitions";
import { generateApplicationNumber } from "../utils/requisitionUtils";
import { requiresRecommendation } from "../utils/authUtils";
import {
  buildRequisitionNotifications,
  findDepartmentHeadsForRequisition,
} from "../utils/notificationUtils";
import { isWithinHoldWindow } from "../utils/validators";

import type { Requisition, RequisitionType, Trip, TripDraft } from "../types";
import { createEmptyTripDraft } from "../types";
import { isValidRoute, parseRoute } from "../utils/routeUtils";

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
  const { addNotification } = useNotifications();
  const { users } = useUsers();
  const { requisitions: existingRequisitions } = useRequisitions();

  // Shown in the form header and used as the requisition's id on submit.
  // Computed once on mount so it doesn't change while the form is open.
  const [applicationNumber] = useState(() =>
    generateApplicationNumber(existingRequisitions.map((item) => item.id)),
  );

  const [sameAsRequester, setSameAsRequester] = useState(true);
  const [transportUser, setTransportUser] = useState<TransportUserDraft>({
    fullName: "",
    designation: "",
    mobile: "",
  });

  const [requisitionType, setRequisitionType] = useState<RequisitionType>(
    () =>
      currentUser?.applicantProfile === "Student"
        ? "Departmental/Official"
        : "Personal",
  );
  const [trips, setTrips] = useState<TripDraft[]>([createEmptyTripDraft()]);

  /**
   * Step 5 — "Personal" requisitions are always exactly one trip. When the
   * applicant switches into Personal from Departmental/Official (which
   * may have accumulated several trips), collapse back down to the first
   * one rather than silently dropping the type check that used to
   * enforce this. Switching the other way keeps whatever trips already
   * exist — Departmental/Official starts from at least one and the
   * applicant can add more.
   */
  function handleRequisitionTypeChange(next: RequisitionType) {
    setRequisitionType(next);
    if (next === "Personal") {
      setTrips((prev) => [prev[0] ?? createEmptyTripDraft()]);
    }
  }

  const [details, setDetails] = useState<DetailsDraft>({
    reason: "",
    supportingDocumentName: "",
    supportingDocumentDataUrl: undefined,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Fix 6 — replaces the old "reproduce a paper signature" block. The
  // applicant already provided a signature once, in Profile Setup; this
  // is a plain digital confirmation, not a re-enactment of it.
  const [declarationConfirmed, setDeclarationConfirmed] = useState(false);

  const requester = currentUser;
  const requiresRecommender = useMemo(
    () =>
      requiresRecommendation(
        requester?.applicantProfile,
        requisitionType,
        requester?.role,
      ),
    [requester?.applicantProfile, requester?.role, requisitionType],
  );

  if (!requester) {
    return (
      <div className="border border-[#FEE2E2] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">
        You must be signed in to apply for a vehicle. Please register or log in
        first.
      </div>
    );
  }

  const isPersonal = requisitionType === "Personal";

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

    for (const trip of trips) {
      if (!trip.date) {
        next[`date-${trip.id}`] = "Date is required.";
      }
      if (!trip.startTime || !trip.endTime) {
        next[`time-${trip.id}`] = "Both From and To times are required.";
      }

      if (isPersonal) {
        if (!trip.destination.trim()) {
          next[`destination-${trip.id}`] = "Destination is required.";
        }
      } else if (!isValidRoute(trip.routeText)) {
        next[`route-${trip.id}`] =
          "Enter the route with at least two stops, separated by ->  (e.g. Campus -> Amborkhana -> Campus).";
      }

      // Step 7 — 3-hour vehicle-hold limit is a hard block, not a
      // dismissible warning (folded into this step's validation per the
      // fix plan's Step 5.6).
      if (
        trip.startTime &&
        trip.endTime &&
        !isWithinHoldWindow(trip.startTime, trip.endTime)
      ) {
        next[`holdLimit-${trip.id}`] =
          "This trip exceeds the 3-hour vehicle-hold limit.";
      }
    }

    if (!details.reason.trim()) {
      next.reason = "Reason for requisition is required.";
    }

    // Fix 6 — required before submit (checked here, in validateAll(),
    // which handleSaveDraft() never calls — so saving a draft still
    // doesn't require it, only a full submit does).
    if (!declarationConfirmed) {
      next.declaration = "You must confirm the declaration before submitting.";
    }

    return next;
  }

  function buildTrip(draft: TripDraft): Trip {
    const destination = draft.destination.trim();
    const stoppageSequence = isPersonal
      ? ["Campus", destination, "Campus"]
      : parseRoute(draft.routeText);
    const route = isPersonal
      ? `Campus to ${destination} and Return to Campus`
      : stoppageSequence.join(" → ");

    return {
      id: draft.id,
      date: draft.date,
      startTime: draft.startTime,
      endTime: draft.endTime,
      vehicleCategory: draft.vehicleCategory,
      route,
      stoppageSequence,
      // The single route box replaced the separate passenger-groups
      // list; the field stays on Trip so older requisitions and the
      // confirmation slip keep working.
      passengerGroups: [],
      status: "Pending",
    };
  }

  function buildRequisition(status: Requisition["status"]): Requisition {
    const builtTrips = status === "Draft" ? [] : trips.map(buildTrip);
    const departmentOrOffice = requester!.department ?? requester!.office ?? "";
    const contactNumber = requester!.mobile ?? transportUser.mobile;
    const firstTripDate = trips[0]?.date ?? "";
    const hasSupportingDocument = Boolean(details.supportingDocumentDataUrl);

    return {
      id: applicationNumber,
      requesterId: requester!.id,
      requesterName:
        requester!.fullName?.trim() || transportUser.fullName.trim() || requester!.email,
      // Phase 6 — needed for mileage eligibility (FRD §23 scopes it to
      // Teacher/Officer personal-use, not every "Personal" requisition).
      applicantProfile: requester!.applicantProfile,
      department: departmentOrOffice.trim() || undefined,
      contactNumber: contactNumber?.trim() || undefined,
      requisitionType,
      purpose: details.reason.trim(),
      startDate: firstTripDate,
      endDate: firstTripDate,
      scheduleType: "Single",
      status,
      createdAt: new Date().toISOString(),
      trips: builtTrips,
      ...(hasSupportingDocument
        ? {
            supportingDocumentName: details.supportingDocumentName,
            supportingDocumentDataUrl: details.supportingDocumentDataUrl,
          }
        : {}),
    };
  }

  function handleSaveDraft() {
    setIsSubmitting(true);
    try {
      const draft = buildRequisition("Draft");
      // Fix 2 — ApplyRequisitionPage.onSubmit already calls
      // addRequisition(...) once persistence is handed to it below; this
      // component only builds the object now. Calling addRequisition
      // here too was writing every save (draft or full submit) into
      // storage twice.
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
        : "Pending on Transport Office";

      const requisition = buildRequisition(finalStatus);
      // Fix 2 — see the comment in handleSaveDraft above; persistence
      // happens once, in ApplyRequisitionPage's onSubmit.
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
    <div className="mx-auto rounded-lg border border-form-rule bg-white px-5 py-6 shadow-sm sm:px-10 sm:py-9">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <img
            src={sustLogo}
            alt="SUST logo"
            className="h-14 w-auto shrink-0"
          />
          <div>
            <p className="text-xs text-form-muted">
              Shahjalal University of Science and Technology · Transport Wing
            </p>
            <h1 className="mt-1 inline-block border-b-2 border-form-action pb-1 text-lg font-bold uppercase tracking-wide text-form-action sm:text-xl">
              Vehicle Requisition Form
            </h1>
          </div>
        </div>

        <div className="text-right">
          <p className="text-xs text-form-muted">Application No.</p>
          <p className="text-base font-bold text-form-action">
            {applicationNumber}
          </p>
        </div>
      </header>

      <div className="mt-8 space-y-8">
        {errorCount > 0 ? (
          <div className="rounded-md border border-form-seal/30 bg-form-seal/5 px-4 py-3 text-sm text-form-seal">
            Please fix {errorCount} field{errorCount === 1 ? "" : "s"} below
            before submitting.
          </div>
        ) : null}

        <FormSection part="Part One" title="Requester Details">
          <Step1Requester requester={requester} />
        </FormSection>

        <FormSection part="Part Two" title="Transport User">
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

        <FormSection part="Part Three" title="Journey">
          <Step3Journey
            requisitionType={requisitionType}
            onRequisitionTypeChange={handleRequisitionTypeChange}
            trips={trips}
            onTripsChange={setTrips}
            applicantProfile={requester.applicantProfile}
            errors={errors}
          />
        </FormSection>

        <FormSection part="Part Four" title="Requisition Details">
          <Step4Details
            value={details}
            onChange={setDetails}
            errors={{ reason: errors.reason }}
          />
        </FormSection>

        {requiresRecommender ? (
          <div
            role="note"
            className="flex items-start gap-2.5 rounded-md border border-form-warn-border bg-form-warn-bg px-3.5 py-2.5 text-sm text-form-warn-text"
          >
            <span
              aria-hidden
              className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-form-warn-text text-[10px] font-bold leading-none"
            >
              !
            </span>
            <p>
              This requisition type requires your Department/Office Head to
              recommend it before Admin can review it.
            </p>
          </div>
        ) : null}

        <div className={SECTION_WRAP}>
          <label className="flex items-start gap-2.5 text-sm leading-relaxed text-form-ink">
            <input
              type="checkbox"
              checked={declarationConfirmed}
              onChange={(event) => setDeclarationConfirmed(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-form-rule text-primary focus:ring-primary"
            />
            I confirm the information above is accurate, and I accept
            responsibility for the vehicle requested.
          </label>
          {errors.declaration ? (
            <p className={`${ERROR_TEXT} ml-6`}>{errors.declaration}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-form-rule pt-5">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-md border border-form-rule bg-white px-4 text-sm font-medium text-form-muted hover:bg-form-band"
          >
            Cancel
          </button>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSubmitting}
              className="h-10 rounded-md border border-form-rule bg-white px-4 text-sm font-medium text-form-ink hover:bg-form-band disabled:cursor-not-allowed"
            >
              Save Draft
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="h-10 rounded-md bg-form-action px-5 text-sm font-medium text-white hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitLabel} →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** One numbered part of the form ("Part One — Requester Details"), echoing how the printed form divides its sections. */
function FormSection({
  part,
  title,
  children,
}: {
  part: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={SECTION_WRAP}>
      <p className={PART_LABEL}>{part}</p>
      <h2 className={`${SECTION_TITLE} mb-3`}>{title}</h2>
      {children}
    </div>
  );
}
