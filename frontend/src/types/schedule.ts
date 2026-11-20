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

export type StudentTransportSchedule = Partial<Record<Weekday, string>>;

export interface StudentTransportVehicle {
  id: string;
  vehicleId: string;
  /*
   * Free-after time keyed by weekday.
   * Days that are not keys (or whose value is empty) mean
   * the vehicle is free all day on that weekday.
   */
  schedule: StudentTransportSchedule;
}
