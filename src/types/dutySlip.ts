export interface DutySlipTripSnapshot {
  tripId: string;
  vehicleId: string;
}

export interface DutySlip {
  id: string;
  requisitionId: string;
  driverId: string;
  trips: DutySlipTripSnapshot[];
  generatedAt: string;
}
