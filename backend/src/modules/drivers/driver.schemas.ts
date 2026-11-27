import { z } from "zod";
import { DRIVER_DESIGNATIONS, DRIVER_STATUSES } from "../../config/constants.js";
import { clearablePhoneNumber, phoneNumber } from "../../http/fields.js";

const name = z.string().trim().min(1, "Driver name is required.").max(150);
const designation = z.enum(DRIVER_DESIGNATIONS, "Choose a valid designation.");

/** Status is not part of create or update: it changes only through activate / deactivate. */
export const createDriverBody = z.strictObject({
  name,
  designation,
  /** Blank or `null` means no phone number. */
  phone: z
    .union([phoneNumber(), z.literal("").transform(() => null), z.null()])
    .optional()
    .transform((value) => value ?? null),
});

export const updateDriverBody = z.strictObject({
  name: name.optional(),
  designation: designation.optional(),
  /** `null` or an empty string removes the number. */
  phone: clearablePhoneNumber(),
});

export const listDriversQuery = z.strictObject({
  status: z.enum(DRIVER_STATUSES).optional(),
  /** Matches the name, designation or phone number. */
  q: z.string().trim().max(100).optional(),
});

export const driverIdParams = z.strictObject({ id: z.uuid("Invalid driver id.") });

export type CreateDriverBody = z.output<typeof createDriverBody>;
export type UpdateDriverBody = z.output<typeof updateDriverBody>;
export type ListDriversQuery = z.output<typeof listDriversQuery>;
