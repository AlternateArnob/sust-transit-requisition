import { useState } from "react";

import {
  REJECTION_REASONS,
  type Requisition,
  type RejectionReason,
  type Trip,
  type Vehicle,
  type Driver,
  type Allocation,
  type DutySlip,
  type UserAccount,
} from "@/types";
import {
  getTripsMissingVehicleAssignment,
  canForwardToAdministrator,
} from "@/features/requisitions/utils/allocationUtils";
import Modal from "@/shared/ui/Modal";
import { buttonClass } from "@/shared/ui/buttonStyles";
import AllocationPicker from "./AllocationPicker";
import GovFormMasthead from "./application/GovFormMasthead";
import { SECTION_TITLE, SECTION_WRAP } from "./application/formTheme";
import DutySlipsSection from "./DutySlipsSection";
import RejectTripForm from "./RejectTripForm";
import RequesterSummary from "./RequesterSummary";
import SendBackForm from "./SendBackForm";
import TripCard, { type RequisitionDetailMode } from "./TripCard";

/**
 * This used to be a single admin-only view that
 * both assigned a vehicle AND made the final approve/reject call in the
 * same action. The FRD splits that into two roles (§9, §19), so this
 * component now renders one of three modes instead:
 *
 *  - "transportInCharge": assign a vehicle per trip, forward the whole
 *    application on, or send it back to the applicant.
 *  - "transportAdministrator": approve/reject each trip using the
 *    vehicle Transport In Charge already picked, send the whole
 *    application back to Transport In Charge, or generate slips.
 *  - "viewOnly": Super Admin oversight — read-only, no action affordances.
 *
 * Keeping this as one component (instead of three near-duplicates) means
 * the trip list / documents markup stays in exactly one place.
 */

interface RequisitionDetailProps {
  requisition: Requisition;
  vehicles: Vehicle[];
  drivers: Driver[];
  allocations: Allocation[];
  dutySlips: DutySlip[];
  mode: RequisitionDetailMode;
  /** The requester's account, used to show their signature on file. */
  requester?: UserAccount;

  // Transport In Charge stage (FRD §9) — omit in other modes.
  onAssignVehicle?: (tripId: string, vehicleId: string, driverId?: string) => void;
  onRemoveVehicleAssignment?: (tripId: string) => void;
  onForwardToAdministrator?: () => void;
  /** The note is optional: an empty string sends the application back with no note. */
  onSendBackToApplicant?: (note: string) => void;
  /** Transport In-Charge may download the driver slip once the requisition is approved. */
  canDownloadDriverSlip?: boolean;

  // Transport Administrator stage (FRD §19) — omit in other modes.
  onApproveTrip?: (tripId: string) => void;
  onRejectTrip?: (tripId: string, reason: RejectionReason, remarks?: string) => void;
  onResetTripDecision?: (tripId: string) => void;
  onSendBackToTransportInCharge?: (remarks: string) => void;
  onGenerateConfirmationSlip?: () => void;
  onGenerateDutySlip?: (driverId: string) => void;
  /** (FRD §22) Transport Office marks a trip Completed once it
   *  actually happened. Independent of approve/reject and of mileage. */
  onCompleteTrip?: (tripId: string) => void;
}
export default function RequisitionDetail({
  requisition,
  vehicles,
  drivers,
  allocations,
  dutySlips,
  mode,
  requester,
  onAssignVehicle,
  onRemoveVehicleAssignment,
  onForwardToAdministrator,
  onSendBackToApplicant,
  canDownloadDriverSlip = false,
  onApproveTrip,
  onRejectTrip,
  onResetTripDecision,
  onSendBackToTransportInCharge,
  onGenerateConfirmationSlip,
  onGenerateDutySlip,
  onCompleteTrip,
}: RequisitionDetailProps) {
  const [rejectingTripId, setRejectingTripId] = useState<string | null>(null);
  const [reason, setReason] = useState<RejectionReason>(REJECTION_REASONS[0]);
  const [remarks, setRemarks] = useState("");
  const [allocatingTrip, setAllocatingTrip] = useState<Trip | null>(null);
  const [showSendBackToApplicant, setShowSendBackToApplicant] = useState(false);
  const [showSendBackToTIC, setShowSendBackToTIC] = useState(false);

  function handleVehicleSelected(vehicleId: string, driverId?: string) {
    if (!allocatingTrip || !onAssignVehicle) {
      return;
    }

    onAssignVehicle(allocatingTrip.id, vehicleId, driverId);
    setAllocatingTrip(null);
  }

  const missingVehicle = getTripsMissingVehicleAssignment(requisition, allocations);
  const canForward = canForwardToAdministrator(requisition, allocations);

  function startReject(tripId: string) {
    setRejectingTripId(tripId);
    setReason(REJECTION_REASONS[0]);
    setRemarks("");
  }

  function confirmReject(tripId: string) {
    onRejectTrip?.(tripId, reason, remarks);
    setRejectingTripId(null);
  }

  function findAllocationForTrip(tripId: string) {
    return allocations.find((item) => item.tripId === tripId);
  }

  return (
    <div className="space-y-7">
      <GovFormMasthead formTitle="Requisition Review" applicationNo={requisition.id} />

      <RequesterSummary requisition={requisition} requester={requester} />

      {requisition.recommenderName ? (
        <div className="rounded-md border border-success/30 bg-success-bg/40 p-4 text-sm text-success">
          <p className="font-medium">
            Recommended by {requisition.recommenderName}
            {requisition.recommendedAt
              ? ` on ${new Date(requisition.recommendedAt).toLocaleDateString()}`
              : ""}
          </p>
          {requisition.recommenderMessage ? (
            <p className="mt-1 text-form-ink">“{requisition.recommenderMessage}”</p>
          ) : null}
        </div>
      ) : null}

      {/* Administrator's send-back reason, visible to Transport
          In Charge until they forward it again. */}
      {requisition.transportOfficeRemarks && mode === "transportInCharge" && (
        <div className="rounded-md border border-form-warn-border bg-form-warn-bg p-4 text-sm text-form-warn-text">
          <p className="font-medium">Sent back by Transport Administrator</p>
          <p className="mt-1">{requisition.transportOfficeRemarks}</p>
        </div>
      )}

      {/* Trips */}
      <div className={SECTION_WRAP}>
        <h2 className={`${SECTION_TITLE} mb-3`}>
          Journey Details ({requisition.trips.length}{" "}
          {requisition.trips.length === 1 ? "trip" : "trips"})
        </h2>

        <div className="space-y-3">
          {requisition.trips.map((trip, index) => {
            const allocation = findAllocationForTrip(trip.id);
            const vehicle = allocation
              ? vehicles.find((item) => item.id === allocation.vehicleId)
              : undefined;
            const assignedDriver = allocation
              ? drivers.find((item) => item.id === allocation.driverId)
              : undefined;

            return (
              <TripCard
                key={trip.id}
                trip={trip}
                index={index}
                mode={mode}
                allocation={allocation}
                vehicle={vehicle}
                assignedDriver={assignedDriver}
                isRejecting={rejectingTripId === trip.id}
                onAssignVehicle={() => setAllocatingTrip(trip)}
                onRemoveVehicle={() => onRemoveVehicleAssignment?.(trip.id)}
                onApprove={() => onApproveTrip?.(trip.id)}
                onStartReject={() => startReject(trip.id)}
                onComplete={() => onCompleteTrip?.(trip.id)}
                onResetDecision={() => onResetTripDecision?.(trip.id)}
              >
                {rejectingTripId === trip.id && (
                  <RejectTripForm
                    reason={reason}
                    remarks={remarks}
                    onReasonChange={setReason}
                    onRemarksChange={setRemarks}
                    onCancel={() => setRejectingTripId(null)}
                    onConfirm={() => confirmReject(trip.id)}
                  />
                )}
              </TripCard>
            );
          })}
        </div>
      </div>

      {/* Transport In Charge — forward / send back */}
      {mode === "transportInCharge" && (
        <div className="space-y-3 rounded-md border border-form-rule bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-secondary">
              {canForward
                ? "Every trip has a vehicle assigned — ready to forward."
                : `${missingVehicle.length} trip(s) still need a vehicle before this can be forwarded.`}
            </p>

            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setShowSendBackToApplicant(true)}
                className={buttonClass("danger")}
              >
                Send Back to Applicant
              </button>

              <button
                type="button"
                onClick={onForwardToAdministrator}
                disabled={!canForward}
                className="h-9 rounded-md bg-form-action px-4 text-sm font-medium text-white hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Forward to Administrator
              </button>
            </div>
          </div>

          {showSendBackToApplicant && (
            <SendBackForm
              withReason={false}
              noteOptional
              remarks={remarks}
              onRemarksChange={setRemarks}
              onCancel={() => {
                setShowSendBackToApplicant(false);
                setRemarks("");
              }}
              onConfirm={() => {
                onSendBackToApplicant?.(remarks.trim());
                setShowSendBackToApplicant(false);
                setRemarks("");
              }}
            />
          )}
        </div>
      )}

      {/* Transport Administrator — send back to Transport In Charge */}
      {mode === "transportAdministrator" && (
        <div className="space-y-3 rounded-md border border-form-rule bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-secondary">
              Not right? Send the whole application back to Transport In Charge instead of deciding
              trip-by-trip.
            </p>

            <button
              type="button"
              onClick={() => setShowSendBackToTIC(true)}
              className={`${buttonClass("danger")} shrink-0`}
            >
              Send Back to Transport In-Charge
            </button>
          </div>

          {showSendBackToTIC && (
            <SendBackForm
              withReason={false}
              remarks={remarks}
              onRemarksChange={setRemarks}
              onCancel={() => setShowSendBackToTIC(false)}
              onConfirm={() => {
                if (!remarks.trim()) return;
                onSendBackToTransportInCharge?.(remarks);
                setShowSendBackToTIC(false);
                setRemarks("");
              }}
            />
          )}
        </div>
      )}

      {mode !== "transportInCharge" && (
        <DutySlipsSection
          requisition={requisition}
          mode={mode}
          drivers={drivers}
          allocations={allocations}
          dutySlips={dutySlips}
          canDownloadDriverSlip={canDownloadDriverSlip}
          onGenerateConfirmationSlip={onGenerateConfirmationSlip}
          onGenerateDutySlip={onGenerateDutySlip}
        />
      )}

      {allocatingTrip && (
        <Modal title="Assign Vehicle" onClose={() => setAllocatingTrip(null)} wide>
          <AllocationPicker
            trip={allocatingTrip}
            allocations={allocations}
            excludeAllocationId={findAllocationForTrip(allocatingTrip.id)?.id}
            onSelect={handleVehicleSelected}
            onCancel={() => setAllocatingTrip(null)}
          />
        </Modal>
      )}
    </div>
  );
}
