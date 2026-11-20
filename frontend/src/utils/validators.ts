export function isRequired(value: string): boolean {
  return value.trim().length > 0;
}

export function isValidDateRange(startDate: string, endDate: string): boolean {
  return Boolean(startDate) && Boolean(endDate) && endDate >= startDate;
}

export function isPositiveNumber(value: string): boolean {
  const parsed = Number(value);
  return value.trim() !== "" && !Number.isNaN(parsed) && parsed > 0;
}

/**
 * Returns true when the duration from `start` to `end` (both HH:mm) does
 * not exceed `maxHours`. Per §4 a single requisition trip cannot keep a
 * vehicle for more than 3 hours without admin flagging.
 */
export function isWithinHoldWindow(
  start: string,
  end: string,
  maxHours = 3,
): boolean {
  if (!start || !end) return true;
  const [fromH = 0, fromM = 0] = start.split(":").map(Number);
  const [toH = 0, toM = 0] = end.split(":").map(Number);
  const startMinutes = fromH * 60 + fromM;
  const endMinutes = toH * 60 + toM;
  if (endMinutes < startMinutes) return false;
  return (endMinutes - startMinutes) / 60 <= maxHours;
}
