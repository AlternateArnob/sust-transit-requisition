/**
 * Step 2 — the Departmental/Official trip form takes the whole route in
 * one text box ("Campus -> Amborkhana -> Zindabazar -> Campus") instead
 * of a list of separate stop inputs. These helpers turn that text into
 * the ordered stop list the rest of the app (Trip.stoppageSequence,
 * slips, conflict checks) already expects.
 */

/** Separators accepted between stops: "->", "→", "=>", "—>", ">" or a new line. */
const ROUTE_SEPARATOR = /\s*(?:->|→|=>|—>|>)\s*|\s*\r?\n\s*/;

export const MIN_ROUTE_STOPS = 2;

export function parseRoute(text: string): string[] {
  return text
    .split(ROUTE_SEPARATOR)
    .map((stop) => stop.trim())
    .filter(Boolean);
}

export function isValidRoute(text: string): boolean {
  return parseRoute(text).length >= MIN_ROUTE_STOPS;
}
