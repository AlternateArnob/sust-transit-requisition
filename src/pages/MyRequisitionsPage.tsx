import { useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";

import useAuth from "../hooks/useAuth";
import useRequisitions from "../hooks/useRequisitions";
import useAllocations from "../hooks/useAllocations";
import useVehicles from "../hooks/useVehicles";
import useDriver from "../hooks/useDriver";

import Modal from "../components/Modal";
import ApplicantRequisitionDetail from "../components/ApplicantRequisitionDetail";
import ApplicantHeader from "../components/ApplicantHeader";
import DataTable from "../components/DataTable";
import PageTitle from "../components/ui/PageTitle";
import { ApplicationStatusBadge } from "../components/ui/StatusBadge";

import { formatDateRange } from "../utils/requisitionUtils";
import { generateConfirmationSlip } from "../utils/pdf/confirmationSlip";

/**
 * Phase 6 — applicant-facing "My Requisitions" page (spec §6, Post-Approval).
 *
 * Lists only the signed-in applicant's own requisitions (matched on
 * `requesterId`) and lets them open each one in a read-only detail view.
 * The Download Confirmation Slip button appears once the Transport
 * Administrator has approved at least one trip (Phase 1 retired the
 * separate "Final Approved" sign-off step) — everything else
 * (approve/reject/allocate) stays admin/recommender-only and is
 * intentionally not reachable here.
 */
export default function MyRequisitionsPage() {
  const { currentUser } = useAuth();
  const { requisitions } = useRequisitions();
  const { allocations } = useAllocations();
  const { vehicles } = useVehicles();
  const { driver } = useDriver();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const myRequisitions = useMemo(() => {
    if (!currentUser) return [];
    return requisitions
      .filter((requisition) => requisition.requesterId === currentUser.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [requisitions, currentUser]);

  // Step 10 — a notification's "requisition" link deep-links here as
  // /my-requisitions?open=<id> instead of an admin route. Once the list
  // has loaded, open that requisition's detail modal automatically, then
  // drop the query param so refreshing/closing doesn't reopen it.
  //
  // The "open" id is applied while rendering (React's documented way to
  // adjust state from changing inputs) rather than inside an effect;
  // `handledOpenId` stops it re-applying before the param is removed.
  const openParam = searchParams.get("open");
  const [handledOpenId, setHandledOpenId] = useState<string | null>(null);
  if (
    openParam &&
    openParam !== handledOpenId &&
    myRequisitions.some((requisition) => requisition.id === openParam)
  ) {
    setHandledOpenId(openParam);
    setSelectedId(openParam);
  } else if (!openParam && handledOpenId) {
    setHandledOpenId(null);
  }

  useEffect(() => {
    if (openParam && openParam === handledOpenId) {
      const next = new URLSearchParams(searchParams);
      next.delete("open");
      setSearchParams(next, { replace: true });
    }
  }, [openParam, handledOpenId, searchParams, setSearchParams]);

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const selected = myRequisitions.find(
    (requisition) => requisition.id === selectedId,
  );

  function handleDownloadConfirmationSlip() {
    if (!selected) return;
    generateConfirmationSlip(selected, allocations, vehicles, driver);
  }

  return (
    <div className="min-h-screen bg-surface">
      <ApplicantHeader active="my-requisitions" title="My Requisitions" />

      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-6">
          <PageTitle
            title="Your requisitions"
            subtitle="Track the status of every vehicle requisition you've submitted, and download the confirmation slip once the Transport Administrator approves."
          />
        </div>

        <DataTable
          rowKey={(requisition) => requisition.id}
          rows={myRequisitions}
          emptyTitle="No requisitions yet"
          emptyDescription="Use New Requisition in the top bar to submit your first one."
          columns={[
            {
              header: "Application No.",
              render: (requisition) => (
                <span className="font-medium text-text">{requisition.id}</span>
              ),
            },
            {
              header: "Purpose",
              render: (requisition) => (
                <span
                  className="block max-w-xs truncate"
                  title={requisition.purpose}
                >
                  {requisition.purpose || "—"}
                </span>
              ),
            },
            {
              header: "Date",
              render: (requisition) =>
                formatDateRange(requisition.startDate, requisition.endDate),
            },
            {
              header: "Status",
              render: (requisition) => (
                <ApplicationStatusBadge status={requisition.status} />
              ),
            },
            {
              header: "Actions",
              align: "right",
              render: (requisition) => (
                <button
                  type="button"
                  onClick={() => setSelectedId(requisition.id)}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View
                </button>
              ),
            },
          ]}
        />
      </main>

      {selected && (
        <Modal
          title={`Requisition — ${selected.id}`}
          onClose={() => setSelectedId(null)}
          wide
        >
          <ApplicantRequisitionDetail
            requisition={selected}
            vehicles={vehicles}
            driver={driver}
            allocations={allocations}
            requester={currentUser}
            onDownloadConfirmationSlip={handleDownloadConfirmationSlip}
          />
        </Modal>
      )}
    </div>
  );
}
