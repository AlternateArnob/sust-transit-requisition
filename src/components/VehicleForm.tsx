import { useEffect, useState } from "react";

import useDriver from "../hooks/useDriver";

import {
  VEHICLE_CATEGORIES,
  VEHICLE_STATUSES,
  type Vehicle,
  type VehicleCategory,
  type VehicleStatus,
} from "../types";

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

  const [reservedFor, setReservedFor] = useState(vehicle?.reservedFor ?? "");

  const [permanentDriverId, setPermanentDriverId] = useState(
    vehicle?.permanentDriverId ?? "",
  );

  const [availableForRequisition, setAvailableForRequisition] = useState(
    vehicle?.availableForRequisition ?? true,
  );

  const [errors, setErrors] = useState<FormErrors>({});

  const [submitError, setSubmitError] = useState("");

  /*
   * When editing a different vehicle, reset form values.
   */
  useEffect(() => {
    setRegistrationNumber(vehicle?.registrationNumber ?? "");

    setCategory(vehicle?.category ?? VEHICLE_CATEGORIES[0]);

    setFuelType(vehicle?.fuelType ?? "");

    setOperationalStatus(vehicle?.operationalStatus ?? "Active");

    setReservedFor(vehicle?.reservedFor ?? "");

    setPermanentDriverId(vehicle?.permanentDriverId ?? "");

    setAvailableForRequisition(vehicle?.availableForRequisition ?? true);

    setErrors({});
    setSubmitError("");
  }, [vehicle]);

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

      reservedFor: reservedFor.trim() || undefined,

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
            text-[#1E293B]
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
            border border-[#E2E8F0]
            px-3
            text-sm text-[#1E293B]
            outline-none
            placeholder:text-[#64748B]
            focus:border-[#334E68]
            focus:ring-1
            focus:ring-[#334E68]
          "
        />

        {errors.registrationNumber && (
          <p className="mt-1 text-xs text-[#B91C1C]">
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
            text-[#1E293B]
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
            border border-[#E2E8F0]
            bg-white px-3
            text-sm text-[#1E293B]
            outline-none
            focus:border-[#334E68]
            focus:ring-1
            focus:ring-[#334E68]
          "
        >
          {VEHICLE_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        {errors.category && (
          <p className="mt-1 text-xs text-[#B91C1C]">{errors.category}</p>
        )}
      </div>

      {/* Fuel */}
      <div>
        <label
          htmlFor="fuelType"
          className="
            mb-1.5 block
            text-sm font-medium
            text-[#1E293B]
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
            border border-[#E2E8F0]
            px-3
            text-sm text-[#1E293B]
            outline-none
            placeholder:text-[#64748B]
            focus:border-[#334E68]
            focus:ring-1
            focus:ring-[#334E68]
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
            text-[#1E293B]
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
            border border-[#E2E8F0]
            bg-white px-3
            text-sm text-[#1E293B]
            outline-none
            focus:border-[#334E68]
            focus:ring-1
            focus:ring-[#334E68]
          "
        >
          {VEHICLE_STATUSES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        {errors.operationalStatus && (
          <p className="mt-1 text-xs text-[#B91C1C]">
            {errors.operationalStatus}
          </p>
        )}
      </div>

      {/* Reserved For */}
      <div>
        <label
          htmlFor="reservedFor"
          className="
            mb-1.5 block
            text-sm font-medium
            text-[#1E293B]
          "
        >
          Reserved For
        </label>

        <input
          id="reservedFor"
          type="text"
          value={reservedFor}
          onChange={(event) => setReservedFor(event.target.value)}
          placeholder="User of the transport"
          className="
            h-10 w-full rounded-md
            border border-[#E2E8F0]
            px-3
            text-sm text-[#1E293B]
            outline-none
            placeholder:text-[#64748B]
            focus:border-[#334E68]
            focus:ring-1
            focus:ring-[#334E68]
          "
        />
      </div>

      {/* Driver */}
      <div>
        <label
          htmlFor="driver"
          className="
            mb-1.5 block
            text-sm font-medium
            text-[#1E293B]
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
            border border-[#E2E8F0]
            bg-white px-3
            text-sm text-[#1E293B]
            outline-none
            focus:border-[#334E68]
            focus:ring-1
            focus:ring-[#334E68]
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
          text-[#1E293B]
        "
        >
          Available for Requisition
        </label>

        <div className="flex gap-5">
          <label
            className="
            flex items-center gap-2
            text-sm text-[#1E293B]
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
            text-sm text-[#1E293B]
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
          border border-[#FECACA]
          bg-[#FEF2F2]
          px-3 py-2
        "
        >
          <p className="text-sm text-[#B91C1C]">{submitError}</p>
        </div>
      )}

      {/* Buttons */}
      <div
        className="
        flex justify-end gap-3
        border-t border-[#E2E8F0]
        pt-4
      "
      >
        <button
          type="button"
          onClick={onCancel}
          className="
            h-10 rounded-md
            border border-[#E2E8F0]
            bg-white px-4
            text-sm font-medium
            text-[#334E68]
            hover:bg-[#F8FAFC]
          "
        >
          Cancel
        </button>

        <button
          type="submit"
          className="
            h-10 rounded-md
            bg-[#0F2747] px-4
            text-sm font-medium
            text-white
            hover:bg-[#334E68]
          "
        >
          {isEditing ? "Save Changes" : "Add Vehicle"}
        </button>
      </div>
    </form>
  );
}
