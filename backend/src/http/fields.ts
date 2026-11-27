import { z } from "zod";

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
