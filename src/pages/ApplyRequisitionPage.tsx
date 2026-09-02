import { useState } from "react";

import useRequisitions from "../hooks/useRequisitions";
import useNotifications from "../hooks/useNotifications";

import RequisitionForm from "../components/RequisitionForm";

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

  const [submitted, setSubmitted] = useState<Requisition | null>(null);

  function handleSubmit(requisition: Requisition) {
    addRequisition(requisition);

    addNotification({
      id: crypto.randomUUID(),
      type: "New Requisition",
      message: `${requisition.requesterName} submitted a ${requisition.requisitionType.toLowerCase()} requisition (${requisition.trips.length} trip${requisition.trips.length === 1 ? "" : "s"})`,
      timestamp: new Date().toISOString(),
      linkType: "requisition",
      linkId: requisition.id,
      isRead: false,
    });

    setSubmitted(requisition);
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="flex h-16 items-center bg-[#0F2747] px-6 text-white">
        <h1 className="text-lg font-semibold">
          SUST Transit — Request a Vehicle
        </h1>
      </header>

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

            <button
              type="button"
              onClick={() => setSubmitted(null)}
              className="mt-6 h-10 rounded-md bg-[#0F2747] px-4 text-sm font-medium text-white hover:bg-[#334E68]"
            >
              Submit another requisition
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-[#E2E8F0] bg-white p-6">
            <p className="mb-6 text-sm text-[#64748B]">
              Fill in the form below to request a vehicle. Personal and
              departmental requests use a simple single-trip form; club and
              official requests can include multiple trips.
            </p>

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
