import { useState } from "react";

import type { Allocation, Driver, DutySlip, Requisition } from "@/types";
import {
  getEligibleDutySlipGroups,
  getDutySlipHistory,
  hasStaleVehicleAssignment,
  canGenerateSlips,
} from "@/features/slips/utils/dutySlipUtils";
import { SECTION_TITLE, SECTION_WRAP } from "./application/formTheme";
import type { RequisitionDetailMode } from "./TripCard";
import { SMALL_ACTION_BUTTON_CLASS } from "@/shared/ui/formStyles";

interface DutySlipsSectionProps {
  requisition: Requisition;
  mode: RequisitionDetailMode;
  drivers: Driver[];
  allocations: Allocation[];
  dutySlips: DutySlip[];
  canDownloadDriverSlip: boolean;
  onGenerateConfirmationSlip?: () => void;
  onGenerateDutySlip?: (driverId: string) => void;
}

export default function DutySlipsSection({
  requisition,
  mode,
  drivers,
  allocations,
  dutySlips,
  canDownloadDriverSlip,
  onGenerateConfirmationSlip,
  onGenerateDutySlip,
}: DutySlipsSectionProps) {
  // Which drivers' superseded-slip history is expanded.
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});
  const dutySlipGroups = getEligibleDutySlipGroups(requisition, allocations);
  const slipsGeneratable = canGenerateSlips(requisition);

  return (
    <div className={SECTION_WRAP}>
      <h2 className={`${SECTION_TITLE} mb-3`}>Documents</h2>

      {mode === "transportAdministrator" && (
        <>
          {slipsGeneratable ? (
            <button
              type="button"
              onClick={onGenerateConfirmationSlip}
              className="mb-3 h-9 rounded-md border border-form-rule px-3 text-sm font-medium text-secondary hover:bg-surface"
            >
              Download Confirmation Slip
            </button>
          ) : (
            <p className="mb-3 text-sm text-form-muted">
              Confirmation slip becomes available once at least one trip is approved.
            </p>
          )}
        </>
      )}

      {dutySlipGroups.length === 0 ? (
        <p className="text-sm text-form-muted">
          No approved & allocated trips yet — duty slips become available once trips are approved.
        </p>
      ) : (
        <div className="space-y-2">
          {dutySlipGroups.map((group) => {
            const assignedDriver = drivers.find((member) => member.id === group.driverId);
            const history = getDutySlipHistory(requisition.id, group.driverId, dutySlips);
            const latestSlip = history[0];
            const stale = latestSlip ? hasStaleVehicleAssignment(latestSlip, allocations) : false;
            const olderSlips = history.slice(1);
            const historyOpen = !!expandedHistory[group.driverId];

            function handleGenerateClick() {
              // Regenerating replaces a slip a driver may
              // already be holding a printed copy of; first-time
              // generation has nothing to supersede, so only confirm
              // when there's an existing slip.
              if (
                latestSlip &&
                !window.confirm(
                  `${assignedDriver?.name ?? "This driver"} already has a duty slip. ` +
                    "Regenerating will mark the current one Superseded. Continue?",
                )
              ) {
                return;
              }
              onGenerateDutySlip?.(group.driverId);
            }

            return (
              <div key={group.driverId} className="rounded-md border border-form-rule px-3 py-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-form-ink">
                      {assignedDriver?.name ?? "Unknown Driver"}
                    </p>

                    <p className="text-xs text-form-muted">{group.trips.length} assigned day(s)</p>

                    {latestSlip && (
                      <span
                        className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          stale ? "bg-warning-bg text-form-warn-text" : "bg-success-bg text-success"
                        }`}
                      >
                        {stale ? "Vehicle changed — regenerate" : "Active"}
                      </span>
                    )}
                  </div>

                  {mode !== "transportAdministrator" && canDownloadDriverSlip && (
                    <button
                      type="button"
                      onClick={() => onGenerateDutySlip?.(group.driverId)}
                      className={SMALL_ACTION_BUTTON_CLASS}
                    >
                      Download Driver Slip
                    </button>
                  )}

                  {mode === "transportAdministrator" && (
                    <button
                      type="button"
                      onClick={handleGenerateClick}
                      className={SMALL_ACTION_BUTTON_CLASS}
                    >
                      {latestSlip ? "Regenerate Duty Slip" : "Generate Duty Slip"}
                    </button>
                  )}
                </div>

                {olderSlips.length > 0 && (
                  <div className="mt-2 border-t border-form-rule pt-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedHistory((current) => ({
                          ...current,
                          [group.driverId]: !current[group.driverId],
                        }))
                      }
                      className="text-xs font-medium text-secondary hover:underline"
                    >
                      {historyOpen ? "Hide" : "Show"} slip history ({olderSlips.length} superseded)
                    </button>

                    {historyOpen && (
                      <ul className="mt-2 space-y-1">
                        {olderSlips.map((slip) => (
                          <li
                            key={slip.id}
                            className="flex items-center justify-between text-xs text-form-muted"
                          >
                            <span>Generated {new Date(slip.generatedAt).toLocaleString()}</span>
                            <span className="inline-flex rounded-full bg-error-bg px-2 py-0.5 font-medium text-error">
                              Superseded — see new slip
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
