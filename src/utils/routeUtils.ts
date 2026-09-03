import type {
  VehicleOffDay,
  Weekday,
  StudentTransportVehicle,
  StudentTransportSchedule,
} from "../types";

const WEEKDAY_INDEX: Weekday[] = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

export function getWeekdayFromDate(dateString: string): Weekday {
  const date = new Date(`${dateString}T00:00:00`);
  return WEEKDAY_INDEX[date.getDay()];
}

export function getOffDayForVehicleOnDate(
  vehicleId: string,
  dateString: string,
  offDays: VehicleOffDay[],
): VehicleOffDay | undefined {
  const weekday = getWeekdayFromDate(dateString);

  return offDays.find((offDay) => {
    if (offDay.vehicleId !== vehicleId) {
      return false;
    }

    if (offDay.type === "One-time") {
      return offDay.date === dateString;
    }

    return offDay.weekday === weekday;
  });
}

export function isVehicleOnOffDay(
  vehicleId: string,
  dateString: string,
  offDays: VehicleOffDay[],
): boolean {
  return Boolean(getOffDayForVehicleOnDate(vehicleId, dateString, offDays));
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function getStudentTransportEntry(
  vehicleId: string,
  routes: StudentTransportVehicle[],
): StudentTransportVehicle | undefined {
  return routes.find((entry) => entry.vehicleId === vehicleId);
}

/*
 * Returns the free-after time for a vehicle on a specific date,
 * or undefined when the vehicle has no schedule entry on that weekday.
 */
export function getStudentTransportTimeForDate(
  vehicleId: string,
  dateString: string,
  routes: StudentTransportVehicle[],
): string | undefined {
  const entry = getStudentTransportEntry(vehicleId, routes);

  if (!entry) {
    return undefined;
  }

  const weekday = getWeekdayFromDate(dateString);
  return entry.schedule[weekday];
}

export function isVehicleFreeAtTime(
  vehicleId: string,
  dateString: string,
  requestedTime: string,
  routes: StudentTransportVehicle[],
): boolean {
  const freeAfter = getStudentTransportTimeForDate(
    vehicleId,
    dateString,
    routes,
  );

  if (!freeAfter) {
    return true;
  }

  return toMinutes(requestedTime) >= toMinutes(freeAfter);
}

export function formatTimeDisplay(time: string): string {
  const [hoursStr, minutes] = time.split(":");
  let hours = parseInt(hoursStr, 10);
  const period = hours >= 12 ? "PM" : "AM";

  hours = hours % 12;

  if (hours === 0) {
    hours = 12;
  }

  return `${hours}:${minutes} ${period}`;
}

const WEEKDAY_FULL: Record<Weekday, string> = {
  Sun: "Sunday",
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
};

export function getWeekdayFull(weekday: Weekday): string {
  return WEEKDAY_FULL[weekday];
}

/*
 * Returns the scheduled weekdays as Weekday[] in Sun..Sat order.
 * Days that have no schedule entry are excluded.
 */
export function getScheduledDays(
  schedule: StudentTransportSchedule,
): Weekday[] {
  return WEEKDAY_INDEX.filter((day) => Boolean(schedule[day]));
}

/*
 * Compresses a set of scheduled weekdays into a compact label
 * like "Sun–Thu" or "Sun, Wed, Fri".
 *
 * Falls back to "—" when no days are scheduled.
 */
export function formatScheduledDays(
  schedule: StudentTransportSchedule,
): string {
  const days = getScheduledDays(schedule);

  if (days.length === 0) {
    return "—";
  }

  /*
   * Find the longest contiguous weekday run and emit it as a
   * compact range like "Sun–Thu".
   */
  let runStart = 0;
  let runEnd = 0;
  let bestStart = 0;
  let bestEnd = -1;

  for (let i = 0; i < days.length; i++) {
    const prevIndex = WEEKDAY_INDEX.indexOf(days[i]);
    const nextIndex =
      i + 1 < days.length ? WEEKDAY_INDEX.indexOf(days[i + 1]) : -1;
    const isContiguous = nextIndex === prevIndex + 1;

    if (isContiguous) {
      runEnd = i + 1;
    } else {
      runEnd = i;
    }

    if (runEnd - runStart >= 2) {
      if (bestEnd - bestStart < runEnd - runStart) {
        bestStart = runStart;
        bestEnd = runEnd;
      }
    }

    if (!isContiguous) {
      runStart = i + 1;
    }
  }

  if (bestEnd >= 0) {
    const firstFull = WEEKDAY_FULL[days[bestStart]];
    const lastFull = WEEKDAY_FULL[days[bestEnd]];

    const common = findCommonSuffix(firstFull, lastFull);

    if (common.length > 0) {
      return (
        firstFull.slice(0, firstFull.length - common.length) +
        "–" +
        days[bestEnd]
      );
    }
  }

  return days.join(", ");
}

function findCommonSuffix(a: string, b: string): string {
  let i = 0;

  while (
    i < a.length &&
    i < b.length &&
    a[a.length - 1 - i] === b[b.length - 1 - i]
  ) {
    i++;
  }

  return a.slice(a.length - i);
}
