// Conversions between MySQL DATETIME(3) strings and JS dates.
// The pool uses `timezone: "Z"` and `dateStrings: true`, so DATETIME columns are read back as
// UTC strings like "2026-11-25 08:00:00.000". Writing a JS Date works as is.

const DB_DATETIME = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?$/;

/** "2026-11-25 08:00:00.000" (UTC) -> Date. Returns null for null/undefined input. */
export function fromDbDateTime(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  const match = DB_DATETIME.exec(value);
  if (!match) throw new Error(`Unexpected DATETIME value: ${value}`);
  const [, date, time, fraction = ""] = match;
  return new Date(`${date}T${time}${fraction.padEnd(4, "0").slice(0, 4)}Z`);
}

/** DATETIME string -> ISO-8601 UTC string for JSON responses (Part 1 §7.1). */
export function toIso(value: string | Date | null | undefined): string | null {
  return fromDbDateTime(value)?.toISOString() ?? null;
}
