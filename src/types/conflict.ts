export type ConflictType = "Transport not available";

export type ConflictResolution = "Rejected" | "Vehicle Reassigned" | "Pending";

export interface Conflict {
  id: string;
  tripId: string;
  vehicleId: string;
  driverId: string;
  date: string;
  startTime: string;
  endTime: string;
  sourceId: string;
  sourceType: "Requisition" | "Recurring Route";
  conflictType: ConflictType;
  resolution?: ConflictResolution;
}
