import { z } from "zod";
import { getWeekdayFromDate } from "../domain/schedule.js";

/** Phone and mobile numbers: 5-30 characters from digits, `+`, `(`, `)`, `-` and space. */
export const PHONE_PATTERN = /^[0-9+()\- ]{5,30}$/;

/** A trimmed phone number that must match `PHONE_PATTERN`. */
export const phoneNumber = (message = "Enter a valid phone number.") =>
  z.string().trim().regex(PHONE_PATTERN, message);

/**
 * An optional phone number on an update: `null` or an empty string removes it, leaving the key out
 * keeps the stored value.
 */
export const clearablePhoneNumber = (message?: string) =>
  z.union([phoneNumber(message), z.literal("").transform(() => null), z.null()]).optional();

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date as `YYYY-MM-DD` (so `2026-02-30` is rejected). Not trimmed: send it exact. */
export const calendarDate = (message = "Enter a valid date (YYYY-MM-DD).") =>
  z
    .string()
    .regex(DATE_PATTERN, message)
    .refine((value) => {
      try {
        getWeekdayFromDate(value);
        return true;
      } catch {
        return false;
      }
    }, message);

/** 24-hour `HH:mm`, e.g. `09:00` or `18:50`. */
export const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const timeOfDay = (message = "Enter a time as HH:mm (24-hour).") =>
  z.string().regex(TIME_OF_DAY_PATTERN, message);
