export interface Allocation {
  id: string;
  requisitionId: string;
  tripId: string;
  vehicleId: string;
  driverId?: string;
  date: string;
  startTime: string;
  endTime: string;
  allocatedAt: string;
  notes?: string;
}
