/** `TRS-2026-001`. The sequence widens naturally past 999 (`TRS-2026-1000`). */
export function formatApplicationNumber(year: number, n: number): string {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new RangeError(`Invalid year ${year}`);
  }
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError(`Invalid application sequence number ${n}`);
  }
  return `TRS-${year}-${String(n).padStart(3, "0")}`;
}

const APPLICATION_NUMBER = /^TRS-\d{4}-\d{3,}$/;

export function isApplicationNumber(value: string): boolean {
  return APPLICATION_NUMBER.test(value);
}
