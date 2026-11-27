import type { UserRole } from "../../src/config/constants.js";

/** Part 1 §16.2: the three privileged accounts the frontend prototype seeded. */
export interface SeedAccount {
  email: string;
  fullName: string;
  role: UserRole;
}

export const SEED_ACCOUNTS: readonly SeedAccount[] = [
  {
    email: "transport-in-charge@sust.edu",
    fullName: "Transport In-Charge",
    role: "TransportInCharge",
  },
  {
    email: "transport-admin@sust.edu",
    fullName: "Transport Administrator",
    role: "TransportAdministrator",
  },
  { email: "superadmin@sust.edu", fullName: "Super Admin", role: "SuperAdmin" },
];
