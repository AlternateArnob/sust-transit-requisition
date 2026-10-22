import type { RequestedVehicleCategory, Trip } from "./trip";
import type { RequisitionType } from "./requisition";

/**
 * Step 5 (applicant module) — one requested trip within a requisition,
 * as held in RequisitionForm's local state before submission.
 *
 * `destination` only applies when the parent requisition type is
 * "Personal" (single simple trip, Campus → destination → Campus).
 * `routeText` only applies to "Departmental/Official" trips, where the
 * applicant types the whole ordered route in one box ("Campus ->
 * Amborkhana -> Campus", parsed by utils/routeUtils.ts) instead of it
 * being synthesized. See buildTrip() in
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
  routeText: string;
}

export function createEmptyTripDraft(): TripDraft {
  return {
    id: crypto.randomUUID(),
    date: "",
    startTime: "",
    endTime: "",
    vehicleCategory: "Any",
    destination: "",
    routeText: "",
  };
}

/**
 * Turns a submitted trip back into the form's draft shape so a returned
 * requisition can be edited. Personal trips are always
 * Campus → destination → Campus, so only the destination is editable;
 * other types get the whole route as text.
 */
export function tripToDraft(trip: Trip, type: RequisitionType): TripDraft {
  const stops = trip.stoppageSequence ?? [];
  return {
    id: trip.id,
    date: trip.date,
    startTime: trip.startTime,
    endTime: trip.endTime,
    vehicleCategory: trip.vehicleCategory,
    destination: type === "Personal" ? (stops[1] ?? "") : "",
    routeText: type === "Personal" ? "" : stops.join(" -> "),
  };
}
