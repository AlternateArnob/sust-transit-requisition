import { MAX_TRIP_HOURS, type RequisitionType } from "../config/constants.js";
import { validation } from "../errors/AppError.js";
import { toMinutes } from "./schedule.js";

export const HOLD_LIMIT_MESSAGE = "This trip exceeds the 3-hour vehicle-hold limit.";
export const MIN_ROUTE_STOPS = 2;

/**
 * True when `end` is not before `start` and the trip lasts at most `maxHours` (Part 1 §11.10).
 * A trip cannot cross midnight, so an end before the start is rejected. Missing times are not this
 * function's concern (the request schema requires them), so they pass.
 */
export function isWithinHoldWindow(start: string, end: string, maxHours = MAX_TRIP_HOURS): boolean {
  if (!start || !end) return true;
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  if (endMinutes < startMinutes) return false;
  return (endMinutes - startMinutes) / 60 <= maxHours;
}

/** Separators accepted between stops: "->", "→", "=>", "—>", ">" or a new line. */
const ROUTE_SEPARATOR = /\s*(?:->|→|=>|—>|>)\s*|\s*\r?\n\s*/;

export function parseRoute(text: string): string[] {
  return text
    .split(ROUTE_SEPARATOR)
    .map((stop) => stop.trim())
    .filter(Boolean);
}

export function isValidRoute(text: string): boolean {
  return parseRoute(text).length >= MIN_ROUTE_STOPS;
}

export interface TripRouteInput {
  /** Personal requisitions: the single destination. */
  destination?: string | null;
  /** Departmental/Official and Club requisitions: the whole route in one text box. */
  routeText?: string | null;
}

export interface BuiltRoute {
  route: string;
  stoppageSequence: string[];
}

/**
 * Builds the stored route of a trip (Part 1 §11.10).
 * - Personal: `["Campus", destination, "Campus"]` and `Campus to X and Return to Campus`.
 * - Others: the stops parsed from `routeText` (at least two), joined with ` → `.
 * Throws a 422 `VALIDATION_ERROR` pointing at `trips.<index>.<field>` when the input is unusable.
 */
export function buildTripFromInput(
  requisitionType: RequisitionType,
  input: TripRouteInput,
  index = 0,
): BuiltRoute {
  if (requisitionType === "Personal") {
    const destination = (input.destination ?? "").trim();
    if (!destination) {
      throw validation([
        { path: `trips.${index}.destination`, message: "Destination is required" },
      ]);
    }
    return {
      route: `Campus to ${destination} and Return to Campus`,
      stoppageSequence: ["Campus", destination, "Campus"],
    };
  }

  const stops = parseRoute(input.routeText ?? "");
  if (stops.length < MIN_ROUTE_STOPS) {
    throw validation([
      {
        path: `trips.${index}.routeText`,
        message: `Route must have at least ${MIN_ROUTE_STOPS} stops`,
      },
    ]);
  }
  return { route: stops.join(" → "), stoppageSequence: stops };
}
