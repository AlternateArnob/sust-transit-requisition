import { PHONE_PATTERN } from "../../http/fields.js";
import { z } from "zod";
import { USER_ROLES } from "../../config/constants.js";
import { paginationShape } from "../../http/pagination.js";
import { PASSWORD_MAX_LENGTH } from "../../services/password.js";
import { USER_SORT_COLUMNS } from "./user.admin.repository.js";

/** Accounts a Super Admin may appoint directly (Part 1 §12.4). */
export const APPOINTABLE_ROLES = [
  "TransportInCharge",
  "TransportAdministrator",
  "SuperAdmin",
] as const;

const MOBILE_PATTERN = PHONE_PATTERN;

/** Lower-cased and trimmed, like the `users.email` column (Part 1 §10.2). */
const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required.")
  .max(255)
  .pipe(z.email("Enter a valid email address."));
const fullName = z.string().trim().min(1, "Full name is required.").max(150);
const mobile = z.string().trim().regex(MOBILE_PATTERN, "Enter a valid mobile number.");
/** An empty string clears a scope, like a cleared form field. */
const scope = z.union([z.string().trim().max(200), z.null()]);

export const createUserBody = z.strictObject({
  fullName,
  email,
  role: z.enum(
    APPOINTABLE_ROLES,
    "Choose Transport In-Charge, Transport Administrator or Super Admin.",
  ),
  password: z.string().min(1, "Password is required.").max(PASSWORD_MAX_LENGTH),
});

export const updateUserBody = z.strictObject({
  fullName: fullName.optional(),
  email: email.optional(),
  /** `null` or an empty string removes the number. */
  mobile: z.union([mobile, z.literal("").transform(() => null), z.null()]).optional(),
  role: z.enum(USER_ROLES).optional(),
  isActive: z.boolean().optional(),
  headOfDepartment: scope.optional(),
  headOfOffice: scope.optional(),
});

const sortKeys = Object.keys(USER_SORT_COLUMNS) as [keyof typeof USER_SORT_COLUMNS];

export const listUsersQuery = z.strictObject({
  role: z.enum(USER_ROLES).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  q: z.string().trim().max(100).optional(),
  sort: z
    .string()
    .regex(new RegExp(`^(${sortKeys.join("|")})(:(asc|desc))?$`), "Use field:asc or field:desc.")
    .default("createdAt:desc")
    .transform((value) => {
      const [key, direction = "asc"] = value.split(":") as [keyof typeof USER_SORT_COLUMNS, string];
      return { sort: key, direction: direction as "asc" | "desc" };
    }),
  ...paginationShape,
});

export const userIdParams = z.strictObject({ id: z.uuid("Invalid user id.") });

export type CreateUserBody = z.infer<typeof createUserBody>;
export type UpdateUserBody = z.infer<typeof updateUserBody>;
export type ListUsersQuery = z.infer<typeof listUsersQuery>;
