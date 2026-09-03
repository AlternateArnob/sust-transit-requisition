import type { VehicleCategory } from "./vehicle";
import type { RejectionReason, TripStatus } from "./requisition";

export interface Trip {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  vehicleCategory: VehicleCategory;
  route: string;
  stoppageSequence: string[];
  passengerGroups: string[];
  status: TripStatus;
  rejectionReason?: RejectionReason;
  rejectionRemarks?: string;
}
