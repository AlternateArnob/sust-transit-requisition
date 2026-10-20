import type { RequestedVehicleCategory } from "./trip";

/**
 * Step 5 (applicant module) — one requested trip within a requisition,
 * as held in RequisitionForm's local state before submission.
 *
 * `destination` only applies when the parent requisition type is
 * "Personal" (single simple trip, Campus → destination → Campus).
 * `stoppages`/`passengerGroups` only apply to "Departmental/Official"
 * trips, where the applicant enters the real ordered stop sequence
 * themselves instead of it being synthesized. See buildTrip() in
 * RequisitionForm.tsx for how each shape is turned into a submitted
 * Trip.
 */
export interface TripDraft {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  vehicleCategory: RequestedVehicleCategory;
  destination: string;
  stoppages: string[];
  passengerGroups: string[];
}

export function createEmptyTripDraft(): TripDraft {
  return {
    id: crypto.randomUUID(),
    date: "",
    startTime: "",
    endTime: "",
    vehicleCategory: "Any",
    destination: "",
    stoppages: [],
    passengerGroups: [],
  };
}
