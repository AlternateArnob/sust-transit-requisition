export type Weekday = "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";

export const WEEKDAYS: Weekday[] = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

export type RouteSlot = "Morning" | "Afternoon" | "Evening" | "Night";

export const ROUTE_SLOTS: RouteSlot[] = [
  "Morning",
  "Afternoon",
  "Evening",
  "Night",
];

export interface RecurringRoute {
  id: string;
  vehicleId: string;
  slot: RouteSlot;
  campusDeparture?: string;
  pointDeparture?: string;
  weekdays: Weekday[];
  stops: string[];
  isActive: boolean;
  notes?: string;
}
