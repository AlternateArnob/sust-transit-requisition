import { APP_TIME_ZONE, WEEKDAYS, type Weekday } from "../config/constants.js";
import type {
  OffDayLike,
  StudentTransportEntryLike,
  StudentTransportSchedule,
} from "../types/index.js";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "HH:mm" or "HH:mm:ss" -> minutes since midnight (seconds are ignored; trips are entered as HH:mm). */
export function toMinutes(time: string): number {
  const [hours = Number.NaN, minutes = Number.NaN] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Weekday of a `YYYY-MM-DD` calendar date, Sun = 0 (as `Date#getDay`). The string is read as a plain
 * calendar date, so the result never depends on the server's time zone. Throws on an invalid date.
 */
export function getWeekdayFromDate(dateString: string): Weekday {
  const match = DATE_PATTERN.exec(dateString);
  if (!match) throw new RangeError(`Invalid date "${dateString}" (expected YYYY-MM-DD)`);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError(`Invalid date "${dateString}"`);
  }
  return WEEKDAYS[date.getUTCDay()] as Weekday;
}

/**
 * Today's calendar date (`YYYY-MM-DD`) in the university time zone (Asia/Dhaka by default).
 * The clock is passed in (`todayString(new Date())` in a service) so the domain stays pure.
 */
export function todayString(now: Date, timeZone: string = APP_TIME_ZONE): string {
  // The en-CA locale formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** `YYYY-MM-DD` plus `days` calendar days (negative goes back). Throws on an invalid date. */
export function addDays(dateString: string, days: number): string {
  getWeekdayFromDate(dateString); // validates the input
  const [year = 0, month = 1, day = 1] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * Whether an off-day touches the date range `from`..`to` (both inclusive, both optional). A
 * One-time off-day must fall inside the range. A Recurring one matches when some date in the range
 * has its weekday, so an open-ended range (a missing bound) matches every weekday.
 */
export function offDayFallsInRange(
  offDay: Pick<OffDayLike, "type" | "date" | "weekday">,
  range: { from?: string; to?: string } = {},
): boolean {
  const { from, to } = range;
  if (offDay.type === "One-time") {
    if (!offDay.date) return false;
    if (from && offDay.date < from) return false;
    if (to && offDay.date > to) return false;
    return true;
  }
  if (!offDay.weekday) return false;
  if (!from || !to) return true;
  // A window of seven days or more contains every weekday, so looking at seven dates is enough.
  let date = from;
  for (let step = 0; step < 7 && date <= to; step += 1) {
    if (getWeekdayFromDate(date) === offDay.weekday) return true;
    date = addDays(date, 1);
  }
  return false;
}

export function getOffDayForVehicleOnDate(
  vehicleId: string,
  dateString: string,
  offDays: OffDayLike[],
): OffDayLike | undefined {
  const weekday = getWeekdayFromDate(dateString);
  return offDays.find((offDay) => {
    if (offDay.vehicleId !== vehicleId) return false;
    if (offDay.type === "One-time") return offDay.date === dateString;
    return offDay.weekday === weekday;
  });
}

export function isVehicleOnOffDay(
  vehicleId: string,
  dateString: string,
  offDays: OffDayLike[],
): boolean {
  return getOffDayForVehicleOnDate(vehicleId, dateString, offDays) !== undefined;
}

export function getStudentTransportEntry(
  vehicleId: string,
  entries: StudentTransportEntryLike[],
): StudentTransportEntryLike | undefined {
  return entries.find((entry) => entry.vehicleId === vehicleId);
}

/** The "free after" time for a vehicle on a date, or undefined when it has no entry that weekday. */
export function getStudentTransportTimeForDate(
  vehicleId: string,
  dateString: string,
  entries: StudentTransportEntryLike[],
): string | undefined {
  const entry = getStudentTransportEntry(vehicleId, entries);
  if (!entry) return undefined;
  return entry.schedule[getWeekdayFromDate(dateString)];
}

/** True when the vehicle is free at `requestedTime` (at or after its "free after" time, if any). */
export function isVehicleFreeAtTime(
  vehicleId: string,
  dateString: string,
  requestedTime: string,
  entries: StudentTransportEntryLike[],
): boolean {
  const freeAfter = getStudentTransportTimeForDate(vehicleId, dateString, entries);
  if (!freeAfter) return true;
  return toMinutes(requestedTime) >= toMinutes(freeAfter);
}

/** "14:30" -> "2:30 PM". */
export function formatTimeDisplay(time: string): string {
  const [hoursText = "0", minutes = "00"] = time.split(":");
  const hours24 = parseInt(hoursText, 10);
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes} ${period}`;
}

/** Scheduled weekdays in Sun..Sat order (weekdays without an entry are left out). */
export function getScheduledDays(schedule: StudentTransportSchedule): Weekday[] {
  return WEEKDAYS.filter((day) => Boolean(schedule[day]));
}
