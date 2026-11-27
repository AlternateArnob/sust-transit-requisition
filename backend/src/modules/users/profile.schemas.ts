import { PHONE_PATTERN } from "../../http/fields.js";
import { z } from "zod";
import { APPLICANT_PROFILES } from "../../config/constants.js";
import { PASSWORD_MAX_LENGTH } from "../../services/password.js";

const optionalText = (max: number) => z.string().trim().max(max).optional();

/** Digits plus the usual separators, e.g. `01712-345678` or `+880 1712 345678`. */
const MOBILE_PATTERN = PHONE_PATTERN;

/**
 * Part 1 §12.3. `fullName` and `mobile` are always required. The other fields depend on the
 * applicant type and on the role, which is checked in the service. An empty string counts as
 * "not given", so a form can send every field every time.
 */
export const updateProfileBody = z.strictObject({
  applicantProfile: z.enum(APPLICANT_PROFILES, "Select your applicant type.").optional(),
  fullName: z.string().trim().min(1, "Full name is required.").max(150),
  mobile: z
    .string()
    .trim()
    .min(1, "Mobile number is required.")
    .pipe(z.string().regex(MOBILE_PATTERN, "Enter a valid mobile number.")),
  department: optionalText(200),
  office: optionalText(200),
  designation: optionalText(150),
  studentRegNumber: optionalText(50),
  password: z.string().max(PASSWORD_MAX_LENGTH).optional(),
});

export const changePasswordBody = z.strictObject({
  currentPassword: z.string().min(1, "Current password is required.").max(PASSWORD_MAX_LENGTH),
  newPassword: z.string().min(1, "New password is required.").max(PASSWORD_MAX_LENGTH),
});

/** The transitional JSON form of the signature upload. */
export const signatureJsonBody = z.strictObject({ signatureDataUrl: z.string().min(1) });

export type UpdateProfileBody = z.infer<typeof updateProfileBody>;
export type ChangePasswordBody = z.infer<typeof changePasswordBody>;
