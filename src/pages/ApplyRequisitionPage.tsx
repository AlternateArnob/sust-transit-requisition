import { useState } from "react";
import { Link } from "react-router-dom";

import useRequisitions from "../hooks/useRequisitions";
import useNotifications from "../hooks/useNotifications";
import useUsers from "../hooks/useUsers";
import {
  buildRequisitionNotifications,
} from "../utils/notificationUtils";

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
  const { users } = useUsers();

  const [submitted, setSubmitted] = useState<Requisition | null>(null);

  function handleSubmit(requisition: Requisition) {
    addRequisition(requisition);

    // Phase 5 — fan the "new requisition" ping out to every verified
    // Admin so each admin's bell filters it in correctly. No-op when
    // there are no admins (e.g. fresh seed before the user logs in).
    const admins = users.filter(
      (user) => user.role === "Admin" && user.isVerified,
    );
    for (const notification of buildRequisitionNotifications(admins, {
      requisition,
      type: "New Requisition",
      message: `${requisition.requesterName} submitted a ${requisition.requisitionType.toLowerCase()} requisition (${requisition.trips.length} trip${requisition.trips.length === 1 ? "" : "s"})`,
    })) {
      addNotification(notification);
    }

    setSubmitted(requisition);
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="flex h-16 items-center justify-between bg-[#0F2747] px-6 text-white">
        <h1 className="text-lg font-semibold">
          SUST Transit — Request a Vehicle
        </h1>
        <Link to="/my-requisitions" className="text-sm hover:underline">
          My Requisitions
        </Link>
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
          <div className="rounded-lg border border-[#E2E8F0] bg-white p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-[#1E293B]">
                Vehicle Requisition Form
              </h2>
              <p className="mt-1 text-sm text-[#64748B]">
                Complete every section below, then submit or save as a
                draft to finish later.
              </p>
            </div>

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
