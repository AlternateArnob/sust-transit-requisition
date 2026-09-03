import { useState } from "react";

import useVehicles from "../hooks/useVehicles";
import useDriver from "../hooks/useDriver";

import StatusBadge from "../components/StatusBadge";
import Modal from "../components/Modal";
import VehicleForm from "../components/VehicleForm";

import type { Vehicle } from "../types";
import { isDuplicateRegistration } from "../utils/vehicleUtils";

export default function VehiclePage() {
  const { vehicles, addVehicle, updateVehicle, deleteVehicle } = useVehicles();

  const { driver, updateDriver } = useDriver();

  const [search, setSearch] = useState("");

  const [category, setCategory] = useState("");

  const [status, setStatus] = useState("");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  const filteredVehicles = vehicles.filter((vehicle) => {
    const matchesSearch = vehicle.registrationNumber
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesCategory = category === "" || vehicle.category === category;

    const matchesStatus = status === "" || vehicle.operationalStatus === status;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  function getDriverName(driverId?: string) {
    if (!driverId) {
      return "No Driver";
    }

    const foundDriver = driver.find((member) => member.id === driverId);

    return foundDriver?.name ?? "No Driver";
  }

  function handleVehicleSubmit(vehicle: Vehicle) {
    const oldVehicle = vehicles.find((item) => item.id === vehicle.id);

    if (
      isDuplicateRegistration(
        vehicles,
        vehicle.registrationNumber,
        vehicle.id,
      )
    ) {
      throw new Error(
        `Registration number "${vehicle.registrationNumber}" is already registered.`,
      );
    }

    const newDriverId = vehicle.permanentDriverId;

    /*
     * ADD VEHICLE
     */
    if (!oldVehicle) {
      if (newDriverId) {
        const foundDriver = driver.find(
          (member) => member.id === newDriverId,
        );

        if (!foundDriver) {
          throw new Error("Selected driver was not found.");
        }

        if (foundDriver.status !== "Active") {
          throw new Error("Inactive drivers cannot be assigned.");
        }

        /*
         * Defensive check.
         *
         * Normally this cannot happen because
         * VehicleForm hides assigned drivers.
         */
        if (foundDriver.permanentVehicleId) {
          throw new Error(
            "This driver is already assigned to another vehicle.",
          );
        }

        addVehicle(vehicle);

        updateDriver({
          ...foundDriver,
          permanentVehicleId: vehicle.id,
        });
      } else {
        addVehicle(vehicle);
      }

      // Close the modal on successful add
      setIsAddModalOpen(false);
      return;
    }

    /*
     * EDIT VEHICLE
     */

    /*
     * Driver did not change.
     */
    if (oldVehicle.permanentDriverId === newDriverId) {
      updateVehicle(vehicle);
      setEditingVehicle(null);
      return;
    }

    /*
     * A new driver was selected.
     */
    if (newDriverId) {
      const newDriver = driver.find((member) => member.id === newDriverId);

      if (!newDriver) {
        throw new Error("Selected driver was not found.");
      }

      if (newDriver.status !== "Active") {
        throw new Error("Inactive drivers cannot be assigned.");
      }

      /*
       * Defensive check.
       */
      if (
        newDriver.permanentVehicleId &&
        newDriver.permanentVehicleId !== vehicle.id
      ) {
        throw new Error("This driver is already assigned to another vehicle.");
      }
    }

    /*
     * Remove the old driver's
     * vehicle assignment.
     */
    if (oldVehicle.permanentDriverId) {
      const oldDriver = driver.find(
        (member) => member.id === oldVehicle.permanentDriverId,
      );

      if (oldDriver) {
        updateDriver({
          ...oldDriver,
          permanentVehicleId: undefined,
        });
      }
    }

    /*
     * Assign the new driver
     * to this vehicle.
     */
    if (newDriverId) {
      const newDriver = driver.find((member) => member.id === newDriverId);

      if (newDriver) {
        updateDriver({
          ...newDriver,
          permanentVehicleId: vehicle.id,
        });
      }
    }

    /*
     * Finally update vehicle and close modal.
     */
    updateVehicle(vehicle);
    setEditingVehicle(null);
  }

  function handleDelete(vehicle: Vehicle) {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${vehicle.registrationNumber}?`,
    );

    if (!confirmed) {
      return;
    }

    /*
     * Remove driver's vehicle
     * assignment first.
     */
    if (vehicle.permanentDriverId) {
      const foundDriver = driver.find(
        (member) => member.id === vehicle.permanentDriverId,
      );

      if (foundDriver) {
        updateDriver({
          ...foundDriver,
          permanentVehicleId: undefined,
        });
      }
    }

    deleteVehicle(vehicle.id);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className="
        flex items-center
        justify-between
      "
      >
        <div>
          <h1 className="text-2xl font-semibold text-[#1E293B]">
            Vehicle Management
          </h1>

          <p
            className="
            mt-1 text-sm
            text-[#64748B]
          "
          >
            Manage university transport vehicles ({vehicles.length} vehicles)
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="
            h-10 rounded-md
            bg-[#0F2747] px-4
            text-sm font-medium
            text-white
            hover:bg-[#334E68]
          "
        >
          + Add Vehicle
        </button>
      </div>

      {/* Filters */}
      <div
        className="
        flex flex-col gap-3
        rounded-lg
        border border-[#E2E8F0]
        bg-white p-4
        md:flex-row
      "
      >
        <input
          type="text"
          placeholder="Search vehicles..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="
            h-10 w-full rounded-md
            border border-[#E2E8F0]
            bg-white px-3
            text-sm text-[#1E293B]
            outline-none
            placeholder:text-[#64748B]
            focus:border-[#334E68]
            focus:ring-1
            focus:ring-[#334E68]
            md:flex-1
          "
        />

        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="
            h-10 rounded-md
            border border-[#E2E8F0]
            bg-white px-3
            text-sm text-[#1E293B]
            outline-none
            focus:border-[#334E68]
            focus:ring-1
            focus:ring-[#334E68]
          "
        >
          <option value="">All Categories</option>

          <option value="Jeep">Jeep</option>

          <option value="Car">Car</option>

          <option value="Mitsubishi Bus">Mitsubishi Bus</option>

          <option value="Hino Bus">Hino Bus</option>

          <option value="Tata Bus">Tata Bus</option>

          <option value="Minibus">Minibus</option>

          <option value="Minibus A/C">Minibus A/C</option>

          <option value="Microbus">Microbus</option>

          <option value="Pickup">Pickup</option>
        </select>

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="
            h-10 rounded-md
            border border-[#E2E8F0]
            bg-white px-3
            text-sm text-[#1E293B]
            outline-none
            focus:border-[#334E68]
            focus:ring-1
            focus:ring-[#334E68]
          "
        >
          <option value="">All Statuses</option>

          <option value="Active">Active</option>

          <option value="Under Maintenance">Under Maintenance</option>

          <option value="Out-of-Service">Out-of-Service</option>
        </select>
      </div>

      {/* Table */}
      <div
        className="
        overflow-hidden
        rounded-lg
        border border-[#E2E8F0]
        bg-white
      "
      >
        <div className="overflow-x-auto">
          <table
            className="
            w-full
            text-left text-sm
          "
          >
            <thead
              className="
              bg-[#0F2747]
              text-white
            "
            >
              <tr>
                <th className="px-4 py-3 font-medium">Registration</th>

                <th className="px-4 py-3 font-medium">Category</th>

                <th className="px-4 py-3 font-medium">Fuel</th>

                <th className="px-4 py-3 font-medium">Driver</th>

                <th className="px-4 py-3 font-medium">Status</th>

                <th className="px-4 py-3 font-medium">Reserved For</th>

                <th className="px-4 py-3 font-medium">Requisition</th>

                <th
                  className="
                  px-4 py-3
                  text-right
                  font-medium
                "
                >
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredVehicles.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="
                      px-4 py-12
                      text-center
                    "
                  >
                    <p
                      className="
                      font-medium
                      text-[#1E293B]
                    "
                    >
                      No vehicles found
                    </p>

                    <p
                      className="
                      mt-1 text-sm
                      text-[#64748B]
                    "
                    >
                      Try changing your search or filters.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredVehicles.map((vehicle, index) => (
                  <tr
                    key={vehicle.id}
                    className={`
                        border-t
                        border-[#E2E8F0]
                        ${index % 2 === 1 ? "bg-[#F8FAFC]" : "bg-white"}
                      `}
                  >
                    <td
                      className="
                        px-4 py-3
                        font-medium
                        text-[#1E293B]
                      "
                    >
                      {vehicle.registrationNumber}
                    </td>

                    <td
                      className="
                        px-4 py-3
                        text-[#64748B]
                      "
                    >
                      {vehicle.category}
                    </td>

                    <td
                      className="
                        px-4 py-3
                        text-[#64748B]
                      "
                    >
                      {vehicle.fuelType ?? "—"}
                    </td>

                    <td
                      className="
                        px-4 py-3
                        font-medium
                        text-[#334E68]
                      "
                    >
                      {getDriverName(vehicle.permanentDriverId)}
                    </td>

                    <td className="px-4 py-3">
                      <StatusBadge status={vehicle.operationalStatus} />
                    </td>

                    <td className="px-4 py-3 text-[#64748B]">
                      {vehicle.reservedFor ?? "—"}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={
                          vehicle.availableForRequisition
                            ? "text-[#15803D]"
                            : "text-[#64748B]"
                        }
                      >
                        {vehicle.availableForRequisition ? "Yes" : "No"}
                      </span>
                    </td>

                    <td
                      className="
                        px-4 py-3
                        text-right
                      "
                    >
                      <div
                        className="
                          flex justify-end
                          gap-3
                        "
                      >
                        <button
                          type="button"
                          onClick={() => setEditingVehicle(vehicle)}
                          className="
                              text-sm
                              font-medium
                              text-[#334E68]
                              hover:underline
                            "
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(vehicle)}
                          className="
                              text-sm
                              font-medium
                              text-[#B91C1C]
                              hover:underline
                            "
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Vehicle Modal */}
      {isAddModalOpen && (
        <Modal title="Add Vehicle" onClose={() => setIsAddModalOpen(false)}>
          <VehicleForm
            onSubmit={handleVehicleSubmit}
            onCancel={() => setIsAddModalOpen(false)}
          />
        </Modal>
      )}

      {/* Edit Vehicle Modal */}
      {editingVehicle && (
        <Modal title="Edit Vehicle" onClose={() => setEditingVehicle(null)}>
          <VehicleForm
            vehicle={editingVehicle}
            onSubmit={handleVehicleSubmit}
            onCancel={() => setEditingVehicle(null)}
          />
        </Modal>
      )}
    </div>
  );
}
