export type DutySlipStatus = "Active" | "Superseded";

export interface DutySlip {
  id: string;
  requisitionId: string;
  driverId: string;
  vehicleId: string;
  driverName: string;
  driverDesignation: string;
  vehicleRegistrationNumber: string;
  vehicleCategory: string;
  reportingLocation: string;
  reportingTime: string;
  tripPurpose: string;
  status: DutySlipStatus;
  supersededById?: string;
}

export interface ConfirmationSlip {
  id: string;
  requisitionId: string;
  tripIds: string[];
  generatedAt: string;
}