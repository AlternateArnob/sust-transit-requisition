import { useState } from "react";

import useStaff from "../hooks/useStaff";
import useVehicles from "../hooks/useVehicles";

import Modal from "../components/Modal";
import StaffForm from "../components/StaffForm";

import type { Staff } from "../types";

export default function StaffPage() {
  const { staff, addStaff, updateStaff, deactivateStaff, deleteStaff } =
    useStaff();
  const { vehicles, updateVehicle } = useVehicles();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

  const filteredStaff = staff.filter((member) => {
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

  function unassignVehicleIfNeeded(member: Staff) {
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

  function handleDeactivate(member: Staff) {
    const confirmed = window.confirm(
      `Are you sure you want to deactivate ${member.name}?`,
    );

    if (!confirmed) {
      return;
    }

    unassignVehicleIfNeeded(member);
    deactivateStaff(member.id);
  }

  function handleDelete(member: Staff) {
    const confirmed = window.confirm(
      `Permanently delete ${member.name}? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    unassignVehicleIfNeeded(member);
    deleteStaff(member.id);
  }

  function handleStaffSubmit(member: Staff) {
    const existingMember = staff.find((item) => item.id === member.id);

    if (!existingMember) {
      addStaff(member);
      setIsAddModalOpen(false);
      return;
    }

    updateStaff(member);
    setEditingStaff(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1E293B]">
            Driver Management
          </h1>

          <p className="mt-1 text-sm text-[#64748B]">
            Manage university drivers ({staff.length} drivers)
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="h-10 rounded-md bg-[#0F2747] px-4 text-sm font-medium text-white hover:bg-[#334E68]"
        >
          + Add Driver
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-[#E2E8F0] bg-white p-4 md:flex-row">
        <input
          type="text"
          placeholder="Search drivers..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-10 w-full rounded-md border border-[#E2E8F0] bg-white px-3 text-sm text-[#1E293B] outline-none placeholder:text-[#64748B] focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68] md:flex-1"
        />

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-10 rounded-md border border-[#E2E8F0] bg-white px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
        >
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#0F2747] text-white">
              <tr>
                <th className="px-4 py-3 font-medium">Driver</th>
                <th className="px-4 py-3 font-medium">Designation</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Vehicle</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <p className="font-medium text-[#1E293B]">
                      No drivers found
                    </p>
                    <p className="mt-1 text-sm text-[#64748B]">
                      Try changing your search or filters.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredStaff.map((member, index) => (
                  <tr
                    key={member.id}
                    className={`border-t border-[#E2E8F0] ${
                      index % 2 === 1 ? "bg-[#F8FAFC]" : "bg-white"
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-[#1E293B]">
                      {member.name}
                    </td>

                    <td className="px-4 py-3 text-[#64748B]">
                      {member.designation}
                    </td>

                    <td className="px-4 py-3 text-[#64748B]">
                      {member.phone ?? "—"}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={
                          member.status === "Active"
                            ? "text-[#15803D]"
                            : "text-[#64748B]"
                        }
                      >
                        {member.status}
                      </span>
                    </td>

                    <td className="px-4 py-3 font-medium text-[#334E68]">
                      {getVehicleRegistration(member.permanentVehicleId)}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setEditingStaff(member)}
                          className="text-sm font-medium text-[#334E68] hover:underline"
                        >
                          Edit
                        </button>

                        {member.status === "Active" && (
                          <button
                            type="button"
                            onClick={() => handleDeactivate(member)}
                            className="text-sm font-medium text-[#B45309] hover:underline"
                          >
                            Deactivate
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDelete(member)}
                          className="text-sm font-medium text-[#B91C1C] hover:underline"
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
          <StaffForm
            onSubmit={handleStaffSubmit}
            onCancel={() => setIsAddModalOpen(false)}
          />
        </Modal>
      )}

      {editingStaff && (
        <Modal title="Edit Driver" onClose={() => setEditingStaff(null)}>
          <StaffForm
            staff={editingStaff}
            onSubmit={handleStaffSubmit}
            onCancel={() => setEditingStaff(null)}
          />
        </Modal>
      )}
    </div>
  );
}
