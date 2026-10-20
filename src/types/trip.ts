import type { VehicleCategory } from "./vehicle";
import type { RejectionReason, TripStatus } from "./requisition";

/**
 * Step 4 (applicant module) — a trip may request any specific fleet
 * category, or the sentinel "Any", letting the Transport Office resolve
 * it to whichever vehicle is available at allocation time.
 */
export type RequestedVehicleCategory = VehicleCategory | "Any";

export interface Trip {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  vehicleCategory: RequestedVehicleCategory;
  route: string;
  stoppageSequence: string[];
  passengerGroups: string[];
  status: TripStatus;
  rejectionReason?: RejectionReason;
  rejectionRemarks?: string;
}
