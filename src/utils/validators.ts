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
