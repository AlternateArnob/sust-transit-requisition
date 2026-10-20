import type { Vehicle } from "../types/vehicle";

export const initialVehicles: Vehicle[] = [
  {
    id: "VEH-001",
    registrationNumber: "Sylhet Metro Gha 11-0035",
    category: "Jeep",
    operationalStatus: "Active",
    reservedFor: "Honorable Vice-Chancellor",
    availableForRequisition: false,
  },
  {
    id: "VEH-002",
    registrationNumber: "Sylhet Metro Gha 11-0036",
    category: "Jeep",
    operationalStatus: "Active",
    reservedFor: "Honorable Treasurer",
    availableForRequisition: false,
  },
  {
    id: "VEH-003",
    registrationNumber: "Sylhet Metro Gha 11-0037",
    category: "Jeep",
    operationalStatus: "Active",
    reservedFor: "Honorable Registrar",
    availableForRequisition: false,
  },
  {
    id: "VEH-010",
    registrationNumber: "Sylhet Cha 11-0593 LPG",
    category: "Microbus",
    fuelType: "LPG",
    operationalStatus: "Active",
    reservedFor: "General Official Use",
    availableForRequisition: true,
  },
];
