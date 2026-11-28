import { z } from "zod";
import { OFF_DAY_TYPES, WEEKDAYS } from "../../config/constants.js";
import { calendarDate } from "../../http/fields.js";

const type = z.enum(OFF_DAY_TYPES, "Choose One-time or Recurring.");
const weekday = z.enum(WEEKDAYS, "Choose a valid weekday.");

/** Blank or `null` means no reason. */
const reason = z
  .union([z.string().trim().max(255, "Keep the reason under 256 characters."), z.null()])
  .transform((value) => (value === null || value === "" ? null : value));

/**
 * One-time needs a date and no weekday; Recurring needs a weekday and no date (the database
 * `ck_offday_shape` check enforces the same rule; this gives the caller a readable 422 first).
 */
export const createOffDayBody = z
  .strictObject({
    vehicleId: z.uuid("Invalid vehicle id."),
    type,
    date: calendarDate().optional(),
    weekday: weekday.optional(),
    reason: reason.optional().transform((value) => value ?? null),
  })
  .superRefine((value, ctx) => {
    if (value.type === "One-time") {
      if (value.date === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["date"],
          message: "A one-time off-day needs a date.",
        });
      }
      if (value.weekday !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["weekday"],
          message: "A one-time off-day cannot have a weekday.",
        });
      }
    } else if (value.type === "Recurring") {
      if (value.weekday === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["weekday"],
          message: "A recurring off-day needs a weekday.",
        });
      }
      if (value.date !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["date"],
          message: "A recurring off-day cannot have a date.",
        });
      }
    }
  });

/**
 * Every field optional. The vehicle cannot be changed (delete and re-create instead). Whether the
 * combination is valid depends on the stored row, so the service checks the shape of the result.
 */
export const updateOffDayBody = z.strictObject({
  type: type.optional(),
  date: calendarDate().optional(),
  weekday: weekday.optional(),
  reason: reason.optional(),
});

export const listOffDaysQuery = z
  .strictObject({
    vehicleId: z.uuid("Invalid vehicle id.").optional(),
    from: calendarDate().optional(),
    to: calendarDate().optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    path: ["to"],
    message: "`to` must not be before `from`.",
  });

export const offDayIdParams = z.strictObject({ id: z.uuid("Invalid off-day id.") });

export type CreateOffDayBody = z.output<typeof createOffDayBody>;
export type UpdateOffDayBody = z.output<typeof updateOffDayBody>;
export type ListOffDaysQuery = z.output<typeof listOffDaysQuery>;
