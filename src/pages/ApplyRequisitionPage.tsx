import { useState } from "react";
import { Link } from "react-router-dom";

import useRequisitions from "../hooks/useRequisitions";
import useNotifications from "../hooks/useNotifications";
import useUsers from "../hooks/useUsers";
import {
  buildRequisitionNotifications,
  findTransportInCharge,
} from "../utils/notificationUtils";

import RequisitionForm from "../components/RequisitionForm";
import ApplicantHeader from "../components/ApplicantHeader";

import type { Requisition } from "../types";

/**
 * Public page for submitting a transport requisition.
 *
 * This intentionally lives OUTSIDE the /admin route tree and the
 * AdminLayout (no sidebar, no admin navbar) — anyone with the link can
 * submit a request here, but only admins (via /admin/requisitions) can
 * review, approve, reject, or allocate them.
 */
export default function ApplyRequisitionPage() {
  const { addRequisition } = useRequisitions();
  const { addNotification } = useNotifications();
  const { users } = useUsers();

  const [submitted, setSubmitted] = useState<Requisition | null>(null);

  function handleSubmit(requisition: Requisition) {
    addRequisition(requisition);

    // Step 8 (applicant module) — per FRD §6, a Departmental/Official
    // requisition from a Student/Teacher/Officer must clear the
    // applicant's Department/Office Head before the Transport Office
    // ever sees it (RequisitionForm.tsx already sets the requisition's
    // initial status to "Pending Recommendation" for that case, and
    // notifies the matching DepartmentHead separately). Only ping
    // Transport In Charge here when the requisition actually lands
    // directly in their queue — i.e. no recommendation was required.
    // Once a DepartmentHead recommends it, RecommenderRequisitionDetailPage
    // is what notifies Transport In Charge, not this page.
    if (requisition.status === "Pending on Transport Office") {
      const recipients = findTransportInCharge(users);
      for (const notification of buildRequisitionNotifications(recipients, {
        requisition,
        type: "New Requisition",
        message: `${requisition.requesterName} submitted a ${requisition.requisitionType.toLowerCase()} requisition (${requisition.trips.length} trip${requisition.trips.length === 1 ? "" : "s"})`,
      })) {
        addNotification(notification);
      }
    }

    setSubmitted(requisition);
  }


  return (
    <div className="min-h-screen bg-form-band">
      <ApplicantHeader active="apply" />

      <main className="mx-auto max-w-3xl px-4 py-10">
        {submitted ? (
          <div className="rounded-lg border border-[#E2E8F0] bg-white p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#DCFCE7]">
              <span className="text-2xl text-[#15803D]">✓</span>
            </div>

            <h2 className="mt-4 text-xl font-semibold text-[#1E293B]">
              Requisition submitted
            </h2>

            <p className="mt-2 text-sm text-[#64748B]">
              Reference ID:{" "}
              <span className="font-medium text-[#1E293B]">{submitted.id}</span>
            </p>

            <p className="mt-1 text-sm text-[#64748B]">
              The transport office has been notified and will review your
              request. You'll be contacted using the phone number you provided
              once a decision is made.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setSubmitted(null)}
                className="h-10 rounded-md bg-[#0F2747] px-4 text-sm font-medium text-white hover:bg-[#334E68]"
              >
                Submit another requisition
              </button>

              <Link
                to="/my-requisitions"
                className="h-10 rounded-md border border-[#E2E8F0] px-4 text-sm font-medium leading-10 text-[#334E68] hover:bg-[#F8FAFC]"
              >
                View My Requisitions
              </Link>
            </div>
          </div>
        ) : (
          <div className="border border-form-rule shadow-sm">
            <RequisitionForm
              onSubmit={handleSubmit}
              onCancel={() => window.history.back()}
            />
          </div>
        )}
      </main>
    </div>
  );
}
