import { useState } from "react";
import {
  DRIVER_DESIGNATIONS,
  type DriverDesignation,
  type Driver,
} from "../types";

interface DriverFormProps {
  driver?: Driver;
  onSubmit: (driver: Driver) => void;
  onCancel: () => void;
}

export default function DriverForm({
  driver,
  onSubmit,
  onCancel,
}: DriverFormProps) {
  const [name, setName] = useState(driver?.name ?? "");

  const [designation, setDesignation] = useState<DriverDesignation>(
    driver?.designation ?? "Driver",
  );

  const [phone, setPhone] = useState(driver?.phone ?? "");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      return;
    }

    const updatedDriver: Driver = {
      id: driver?.id ?? crypto.randomUUID(),

      name: name.trim(),

      designation,

      phone: phone.trim() || undefined,

      status: driver?.status ?? "Active",

      permanentVehicleId: driver?.permanentVehicleId,
    };

    onSubmit(updatedDriver);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name */}
      <div>
        <label
          htmlFor="name"
          className="mb-1.5 block text-sm font-medium text-[#1E293B]"
        >
          Driver Name
        </label>

        <input
          id="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Enter driver name"
          className="
            h-10 w-full rounded-md
            border border-[#E2E8F0]
            px-3 text-sm text-[#1E293B]
            outline-none
            placeholder:text-[#64748B]
            focus:border-[#334E68]
            focus:ring-1
            focus:ring-[#334E68]
          "
        />
      </div>

      {/* Designation */}
      <div>
        <label
          htmlFor="designation"
          className="mb-1.5 block text-sm font-medium text-[#1E293B]"
        >
          Designation
        </label>

        <select
          id="designation"
          value={designation}
          onChange={(event) =>
            setDesignation(event.target.value as DriverDesignation)
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
          {DRIVER_DESIGNATIONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      {/* Phone */}
      <div>
        <label
          htmlFor="phone"
          className="mb-1.5 block text-sm font-medium text-[#1E293B]"
        >
          Phone
        </label>

        <input
          id="phone"
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="Enter phone number"
          className="
            h-10 w-full rounded-md
            border border-[#E2E8F0]
            px-3 text-sm text-[#1E293B]
            outline-none
            placeholder:text-[#64748B]
            focus:border-[#334E68]
            focus:ring-1
            focus:ring-[#334E68]
          "
        />
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-3 border-t border-[#E2E8F0] pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="
            h-10 rounded-md
            border border-[#E2E8F0]
            px-4
            text-sm font-medium text-[#334E68]
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
            text-sm font-medium text-white
            hover:bg-[#334E68]
          "
        >
          {driver ? "Save Changes" : "Add Driver"}
        </button>
      </div>
    </form>
  );
}
