import { useState } from "react";

import useDriver from "../hooks/useDriver";

import {
  VEHICLE_CATEGORIES,
  VEHICLE_STATUSES,
  type Vehicle,
  type VehicleCategory,
  type VehicleStatus,
} from "../types";
import { buttonClass } from "./ui/buttonStyles";

interface VehicleFormProps {
  vehicle?: Vehicle;
  onSubmit: (vehicle: Vehicle) => void;
  onCancel: () => void;
}

interface FormErrors {
  registrationNumber?: string;
  category?: string;
  operationalStatus?: string;
}

export default function VehicleForm({
  vehicle,
  onSubmit,
  onCancel,
}: VehicleFormProps) {
  const isEditing = Boolean(vehicle);

  const { driver } = useDriver();

  /*
   * Only show:
   * 1. Active drivers
   * 2. Drivers who are unassigned
   * 3. The driver currently assigned to this vehicle when editing
   */
  const availableDrivers = driver.filter(
    (member) =>
      member.status === "Active" &&
      (!member.permanentVehicleId || member.permanentVehicleId === vehicle?.id),
  );

  const [registrationNumber, setRegistrationNumber] = useState(
    vehicle?.registrationNumber ?? "",
  );

  const [category, setCategory] = useState<VehicleCategory>(
    vehicle?.category ?? VEHICLE_CATEGORIES[0],
  );

  const [fuelType, setFuelType] = useState(vehicle?.fuelType ?? "");

  const [operationalStatus, setOperationalStatus] = useState<VehicleStatus>(
    vehicle?.operationalStatus ?? "Active",
  );


  const [permanentDriverId, setPermanentDriverId] = useState(
    vehicle?.permanentDriverId ?? "",
  );

  const [availableForRequisition, setAvailableForRequisition] = useState(
    vehicle?.availableForRequisition ?? true,
  );

  const [errors, setErrors] = useState<FormErrors>({});

  const [submitError, setSubmitError] = useState("");


  function validate(): boolean {
    const newErrors: FormErrors = {};

    if (!registrationNumber.trim()) {
      newErrors.registrationNumber = "Registration number is required.";
    }

    if (!category) {
      newErrors.category = "Category is required.";
    }

    if (!operationalStatus) {
      newErrors.operationalStatus = "Operational status is required.";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmitError("");

    if (!validate()) {
      return;
    }

    const vehicleData: Vehicle = {
      id: vehicle?.id ?? crypto.randomUUID(),

      registrationNumber: registrationNumber.trim().toUpperCase(),

      category,

      fuelType: fuelType.trim() || undefined,

      operationalStatus,

      permanentDriverId: permanentDriverId || undefined,

      availableForRequisition,
    };

    try {
      onSubmit(vehicleData);
    } catch (error) {
      if (error instanceof Error) {
        setSubmitError(error.message);
      } else {
        setSubmitError("Something went wrong. Please try again.");
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Registration Number */}
      <div>
        <label
          htmlFor="registrationNumber"
          className="
            mb-1.5 block
            text-sm font-medium
            text-text
          "
        >
          Registration Number
        </label>

        <input
          id="registrationNumber"
          type="text"
          value={registrationNumber}
          onChange={(event) => setRegistrationNumber(event.target.value)}
          placeholder="e.g. SUST-001"
          className="
            h-10 w-full rounded-md
            border border-border
            px-3
            text-sm text-text
            outline-none
            placeholder:text-text-muted
            focus:border-secondary
            focus:ring-1
            focus:ring-secondary
          "
        />

        {errors.registrationNumber && (
          <p className="mt-1 text-xs text-error">
            {errors.registrationNumber}
          </p>
        )}
      </div>

      {/* Category */}
      <div>
        <label
          htmlFor="category"
          className="
            mb-1.5 block
            text-sm font-medium
            text-text
          "
        >
          Category
        </label>

        <select
          id="category"
          value={category}
          onChange={(event) =>
            setCategory(event.target.value as VehicleCategory)
          }
          className="
            h-10 w-full rounded-md
            border border-border
            bg-white px-3
            text-sm text-text
            outline-none
            focus:border-secondary
            focus:ring-1
            focus:ring-secondary
          "
        >
          {VEHICLE_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        {errors.category && (
          <p className="mt-1 text-xs text-error">{errors.category}</p>
        )}
      </div>

      {/* Fuel */}
      <div>
        <label
          htmlFor="fuelType"
          className="
            mb-1.5 block
            text-sm font-medium
            text-text
          "
        >
          Fuel Type
        </label>

        <input
          id="fuelType"
          type="text"
          value={fuelType}
          onChange={(event) => setFuelType(event.target.value)}
          placeholder="e.g. Diesel"
          className="
            h-10 w-full rounded-md
            border border-border
            px-3
            text-sm text-text
            outline-none
            placeholder:text-text-muted
            focus:border-secondary
            focus:ring-1
            focus:ring-secondary
          "
        />
      </div>

      {/* Operational Status */}
      <div>
        <label
          htmlFor="operationalStatus"
          className="
            mb-1.5 block
            text-sm font-medium
            text-text
          "
        >
          Operational Status
        </label>

        <select
          id="operationalStatus"
          value={operationalStatus}
          onChange={(event) =>
            setOperationalStatus(event.target.value as VehicleStatus)
          }
          className="
            h-10 w-full rounded-md
            border border-border
            bg-white px-3
            text-sm text-text
            outline-none
            focus:border-secondary
            focus:ring-1
            focus:ring-secondary
          "
        >
          {VEHICLE_STATUSES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        {errors.operationalStatus && (
          <p className="mt-1 text-xs text-error">
            {errors.operationalStatus}
          </p>
        )}
      </div>

      {/* Driver */}
      <div>
        <label
          htmlFor="driver"
          className="
            mb-1.5 block
            text-sm font-medium
            text-text
          "
        >
          Driver
        </label>

        <select
          id="driver"
          value={permanentDriverId}
          onChange={(event) => setPermanentDriverId(event.target.value)}
          className="
            h-10 w-full rounded-md
            border border-border
            bg-white px-3
            text-sm text-text
            outline-none
            focus:border-secondary
            focus:ring-1
            focus:ring-secondary
          "
        >
          <option value="">No Driver</option>

          {availableDrivers.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.name} — {driver.designation}
            </option>
          ))}
        </select>
      </div>

      {/* Requisition */}
      <div>
        <label
          className="
          mb-2 block
          text-sm font-medium
          text-text
        "
        >
          Available for Requisition
        </label>

        <div className="flex gap-5">
          <label
            className="
            flex items-center gap-2
            text-sm text-text
          "
          >
            <input
              type="radio"
              name="availableForRequisition"
              checked={availableForRequisition}
              onChange={() => setAvailableForRequisition(true)}
            />
            Yes
          </label>

          <label
            className="
            flex items-center gap-2
            text-sm text-text
          "
          >
            <input
              type="radio"
              name="availableForRequisition"
              checked={!availableForRequisition}
              onChange={() => setAvailableForRequisition(false)}
            />
            No
          </label>
        </div>
      </div>

      {/* Submit Error */}
      {submitError && (
        <div
          className="
          rounded-md
          border border-error/30
          bg-error-bg/50
          px-3 py-2
        "
        >
          <p className="text-sm text-error">{submitError}</p>
        </div>
      )}

      {/* Buttons */}
      <div
        className="
        flex justify-end gap-3
        border-t border-border
        pt-4
      "
      >
        <button
          type="button"
          onClick={onCancel}
          className={buttonClass("secondary")}
        >
          Cancel
        </button>

        <button
          type="submit"
          className={buttonClass("primary")}
        >
          {isEditing ? "Save Changes" : "Add Vehicle"}
        </button>
      </div>
    </form>
  );
}
