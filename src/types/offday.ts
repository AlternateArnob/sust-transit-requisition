import type { Weekday } from "./schedule";

export type OffDayType = "One-time" | "Recurring";

export interface VehicleOffDay {
  id: string;
  vehicleId: string;
  type: OffDayType;
  date?: string;
  weekday?: Weekday;
  reason?: string;
}
