import { z } from "zod";
import { VEHICLE_CATEGORIES, VEHICLE_OPERATIONAL_STATUSES } from "../../config/constants.js";

/** Trimmed, inner whitespace collapsed, upper-cased: the stored form (Part 1 §12.5). */
export const normalizeRegistration = (value: string): string =>
  value.trim().replace(/\s+/g, " ").toUpperCase();

const registrationNumber = z
  .string()
  .trim()
  .min(1, "Registration number is required.")
  .max(100)
  .transform(normalizeRegistration);

const category = z.enum(VEHICLE_CATEGORIES, "Choose a valid vehicle category.");
const operationalStatus = z.enum(VEHICLE_OPERATIONAL_STATUSES, "Choose a valid status.");

/** Blank or `null` means no fuel type. */
const fuelType = z
  .union([z.string().trim().max(50), z.null()])
  .transform((value) => (value === null || value === "" ? null : value));

const permanentDriverId = z.union([z.uuid("Invalid driver id."), z.null()]);

export const createVehicleBody = z.strictObject({
  registrationNumber,
  category,
  fuelType: fuelType.optional().transform((value) => value ?? null),
  operationalStatus: operationalStatus.default("Active"),
  availableForRequisition: z.boolean().default(true),
  permanentDriverId: permanentDriverId.optional().transform((value) => value ?? null),
});

/** Every field optional; `permanentDriverId: null` clears the assignment. */
export const updateVehicleBody = z.strictObject({
  registrationNumber: registrationNumber.optional(),
  category: category.optional(),
  fuelType: fuelType.optional(),
  operationalStatus: operationalStatus.optional(),
  availableForRequisition: z.boolean().optional(),
  permanentDriverId: permanentDriverId.optional(),
});

export const listVehiclesQuery = z.strictObject({
  /** Matches the registration number or category. */
  q: z.string().trim().max(100).optional(),
  category: category.optional(),
  status: operationalStatus.optional(),
});

export const vehicleIdParams = z.strictObject({ id: z.uuid("Invalid vehicle id.") });

export type CreateVehicleBody = z.output<typeof createVehicleBody>;
export type UpdateVehicleBody = z.output<typeof updateVehicleBody>;
export type ListVehiclesQuery = z.output<typeof listVehiclesQuery>;
