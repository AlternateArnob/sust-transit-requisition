import { useState } from "react";

import useDriver from "../hooks/useDriver";
import useVehicles from "../hooks/useVehicles";

import Modal from "../components/Modal";
import DriverForm from "../components/DriverForm";

import type { Driver } from "../types";
import { buttonClass } from "../components/ui/buttonStyles";
import PageTitle from "../components/ui/PageTitle";

export default function DriverPage() {
  const {
    driver,
    addDriver,
    updateDriver,
    deactivateDriver,
    activateDriver,
    deleteDriver,
  } = useDriver();
  const { vehicles, updateVehicle } = useVehicles();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  const filteredDriver = driver.filter((member) => {
    const matchesSearch =
      member.name.toLowerCase().includes(search.toLowerCase()) ||
      member.designation.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "" || member.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  function getVehicleRegistration(vehicleId?: string) {
    if (!vehicleId) {
      return "Unassigned";
    }

    const vehicle = vehicles.find((item) => item.id === vehicleId);
    return vehicle?.registrationNumber ?? "Unassigned";
  }

  function unassignVehicleIfNeeded(member: Driver) {
    if (!member.permanentVehicleId) {
      return;
    }

    const vehicle = vehicles.find(
      (item) => item.id === member.permanentVehicleId,
    );

    if (vehicle && vehicle.permanentDriverId === member.id) {
      updateVehicle({ ...vehicle, permanentDriverId: undefined });
    }
  }

  function handleDeactivate(member: Driver) {
    const confirmed = window.confirm(
      `Are you sure you want to deactivate ${member.name}?`,
    );

    if (!confirmed) {
      return;
    }

    unassignVehicleIfNeeded(member);
    deactivateDriver(member.id);
  }

  function handleActivate(member: Driver) {
    activateDriver(member.id);
  }

  function handleDelete(member: Driver) {
    const confirmed = window.confirm(
      `Permanently delete ${member.name}? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    unassignVehicleIfNeeded(member);
    deleteDriver(member.id);
  }

  function handleDriverSubmit(member: Driver) {
    const existingMember = driver.find((item) => item.id === member.id);

    if (!existingMember) {
      addDriver(member);
      setIsAddModalOpen(false);
      return;
    }

    updateDriver(member);
    setEditingDriver(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageTitle title="Driver Management" subtitle={<>Manage university drivers ({driver.length} drivers)</>} />

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className={buttonClass("primary")}
        >
          + Add Driver
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-white shadow-sm p-4 md:flex-row">
        <input
          type="text"
          placeholder="Search drivers..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-text outline-none placeholder:text-text-muted focus:border-secondary focus:ring-1 focus:ring-secondary md:flex-1"
        />

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-10 rounded-md border border-border bg-white px-3 text-sm text-text outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
        >
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface text-xs uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Driver</th>
                <th className="px-4 py-3 font-semibold">Designation</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Vehicle</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredDriver.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <p className="font-medium text-text">
                      No drivers found
                    </p>
                    <p className="mt-1 text-sm text-text-muted">
                      Try changing your search or filters.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredDriver.map((member, index) => (
                  <tr
                    key={member.id}
                    className={`border-t border-border ${
                      index % 2 === 1 ? "bg-surface" : "bg-white"
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-text">
                      {member.name}
                    </td>

                    <td className="px-4 py-3 text-text-muted">
                      {member.designation}
                    </td>

                    <td className="px-4 py-3 text-text-muted">
                      {member.phone ?? "—"}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={
                          member.status === "Active"
                            ? "text-success"
                            : "text-text-muted"
                        }
                      >
                        {member.status}
                      </span>
                    </td>

                    <td className="px-4 py-3 font-medium text-secondary">
                      {getVehicleRegistration(member.permanentVehicleId)}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setEditingDriver(member)}
                          className="text-sm font-medium text-secondary hover:underline"
                        >
                          Edit
                        </button>

                        {member.status === "Active" ? (
                          <button
                            type="button"
                            onClick={() => handleDeactivate(member)}
                            className="text-sm font-medium text-warning hover:underline"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleActivate(member)}
                            className="text-sm font-medium text-success hover:underline"
                          >
                            Activate
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDelete(member)}
                          className="text-sm font-medium text-error hover:underline"
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

      {isAddModalOpen && (
        <Modal title="Add Driver" onClose={() => setIsAddModalOpen(false)}>
          <DriverForm
            onSubmit={handleDriverSubmit}
            onCancel={() => setIsAddModalOpen(false)}
          />
        </Modal>
      )}

      {editingDriver && (
        <Modal title="Edit Driver" onClose={() => setEditingDriver(null)}>
          <DriverForm
            driver={editingDriver}
            onSubmit={handleDriverSubmit}
            onCancel={() => setEditingDriver(null)}
          />
        </Modal>
      )}
    </div>
  );
}
