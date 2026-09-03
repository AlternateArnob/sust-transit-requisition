import type { Weekday } from "./route";

export type OffDayType = "One-time" | "Recurring";

export interface VehicleOffDay {
  id: string;
  vehicleId: string;
  type: OffDayType;
  date?: string;
  weekday?: Weekday;
  reason?: string;
}
