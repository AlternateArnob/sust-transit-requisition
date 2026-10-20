import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";

import useAuth from "../hooks/useAuth";
import useRequisitions from "../hooks/useRequisitions";
import useAllocations from "../hooks/useAllocations";
import useVehicles from "../hooks/useVehicles";
import useDriver from "../hooks/useDriver";

import Modal from "../components/Modal";
import ApplicantRequisitionDetail from "../components/ApplicantRequisitionDetail";
import ApplicantHeader from "../components/ApplicantHeader";

import { formatDateRange } from "../utils/requisitionUtils";
import { generateConfirmationSlip } from "../utils/pdf/confirmationSlip";

import type { ApplicationStatus } from "../types";

function statusBadgeClass(status: ApplicationStatus) {
  if (status === "Approved") return "bg-[#DCFCE7] text-[#15803D]";
  if (status === "Completed") return "bg-[#CBD5E1] text-[#1E293B]";
  if (status === "Rejected") return "bg-[#FEE2E2] text-[#B91C1C]";
  if (status === "Information Requested") return "bg-[#FEF3C7] text-[#B45309]";
  if (status === "Partially Approved") return "bg-[#FEF3C7] text-[#B45309]";
  if (status === "Draft") return "bg-[#F1F5F9] text-[#64748B]";
  return "bg-[#DBEAFE] text-[#0F2747]";
}

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
  useEffect(() => {
    const openId = searchParams.get("open");
    if (openId && myRequisitions.some((requisition) => requisition.id === openId)) {
      setSelectedId(openId);
      const next = new URLSearchParams(searchParams);
      next.delete("open");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, myRequisitions, setSearchParams]);

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
    <div className="min-h-screen bg-[#F8FAFC]">
      <ApplicantHeader active="my-requisitions" title="My Requisitions" />

      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-[#1E293B]">
            Your requisitions
          </h2>
          <p className="mt-1 text-sm text-[#64748B]">
            Track the status of every vehicle requisition you've submitted,
            and download the confirmation slip once Admin gives final
            approval.
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0F2747] text-white">
                <tr>
                  <th className="px-4 py-3 font-medium">Purpose</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {myRequisitions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center">
                      <p className="font-medium text-[#1E293B]">
                        No requisitions yet
                      </p>
                      <p className="mt-1 text-sm text-[#64748B]">
                        <Link
                          to="/apply"
                          className="font-medium text-[#334E68] hover:underline"
                        >
                          Submit your first requisition
                        </Link>
                      </p>
                    </td>
                  </tr>
                ) : (
                  myRequisitions.map((requisition, index) => (
                    <tr
                      key={requisition.id}
                      className={`border-t border-[#E2E8F0] ${
                        index % 2 === 1 ? "bg-[#F8FAFC]" : "bg-white"
                      }`}
                    >
                      <td
                        className="max-w-xs truncate px-4 py-3 text-[#1E293B]"
                        title={requisition.purpose}
                      >
                        {requisition.purpose || "—"}
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">
                        {formatDateRange(
                          requisition.startDate,
                          requisition.endDate,
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(
                            requisition.status,
                          )}`}
                        >
                          {requisition.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedId(requisition.id)}
                          className="text-sm font-medium text-[#334E68] hover:underline"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
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
