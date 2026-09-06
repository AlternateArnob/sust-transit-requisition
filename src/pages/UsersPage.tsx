import { useState } from "react";

import useAuth from "../hooks/useAuth";
import useUsers from "../hooks/useUsers";
import useNotifications from "../hooks/useNotifications";

import Modal from "../components/Modal";
import { ADMIN_ROLES, type AdminRole } from "../utils/permissions";
import { buildAccountStatusNotification } from "../utils/notificationUtils";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../utils/passwordUtils";
import type { UserAccount } from "../types";

/**
 * Phase 9 (admin module) — Super Admin console (FRD §2, §24).
 *
 * Decision A (§3 of the Phase 9 plan): this console can create new
 * Transport Office accounts, not just manage the 3 seed ones — without
 * that, there would be no way to ever onboard a 4th person into any of
 * these roles, which falls short of what "appointed internally" (§2)
 * implies someone has to actually do.
 *
 * Decision A (§4): self-lockout and last-Super-Admin guardrails are
 * hard blocks, not confirmations — see rowLockFor() below. A
 * lost-the-only-Super-Admin-account mistake has no undo path in this
 * local-storage-only app, unlike most other destructive actions here.
 */
export default function UsersPage() {
  const { currentUser } = useAuth();
  const { users, add, update } = useUsers();
  const { addNotification } = useNotifications();

  const [showCreate, setShowCreate] = useState(false);

  const transportOfficeUsers = [...users]
    .filter((user) => ADMIN_ROLES.includes(user.role as AdminRole))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const activeSuperAdminCount = transportOfficeUsers.filter(
    (user) => user.role === "SuperAdmin" && user.isActive !== false,
  ).length;

  /**
   * §4 decision A — block, don't just confirm. A row's own controls are
   * fully disabled when acting on it would either lock the acting
   * Super Admin out of their own account, or leave the system with zero
   * active Super Admins (checked against ANY account, not just self).
   */
  function rowLockFor(user: UserAccount): {
    locked: boolean;
    reason?: string;
  } {
    if (user.id === currentUser?.id) {
      return {
        locked: true,
        reason: "You can't deactivate or reassign your own account here.",
      };
    }

    const isLastActiveSuperAdmin =
      user.role === "SuperAdmin" &&
      user.isActive !== false &&
      activeSuperAdminCount <= 1;

    if (isLastActiveSuperAdmin) {
      return {
        locked: true,
        reason:
          "This is the only active Super Admin account — deactivate or reassign another Super Admin first.",
      };
    }

    return { locked: false };
  }

  function handleSetActive(user: UserAccount, isActive: boolean) {
    update(user.id, { isActive });

    addNotification(
      buildAccountStatusNotification(
        user.id,
        isActive
          ? "Your account has been reactivated by a Super Admin."
          : "Your account has been deactivated by a Super Admin.",
      ),
    );
  }

  function handleRoleChange(user: UserAccount, role: AdminRole) {
    if (role === user.role) return;
    update(user.id, { role });

    addNotification(
      buildAccountStatusNotification(
        user.id,
        `Your role was changed to ${role} by a Super Admin.`,
      ),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#1E293B]">
            Transport Office Accounts
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Activate, deactivate, or reassign the role of any Transport In
            Charge, Transport Administrator, or Super Admin account.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="h-9 rounded-md bg-[#0F2747] px-4 text-sm font-medium text-white hover:bg-[#334E68]"
        >
          Add Account
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#0F2747] text-white">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {transportOfficeUsers.map((user, index) => {
                const { locked, reason } = rowLockFor(user);
                const isActive = user.isActive !== false;

                return (
                  <tr
                    key={user.id}
                    className={`border-t border-[#E2E8F0] ${index % 2 === 1 ? "bg-[#F8FAFC]" : "bg-white"}`}
                  >
                    <td className="px-4 py-3 font-medium text-[#1E293B]">
                      {user.fullName ?? "—"}
                      {user.id === currentUser?.id && (
                        <span className="ml-2 text-xs font-normal text-[#64748B]">
                          (you)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#64748B]">{user.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={user.role}
                        disabled={locked}
                        title={locked ? reason : undefined}
                        onChange={(event) =>
                          handleRoleChange(
                            user,
                            event.target.value as AdminRole,
                          )
                        }
                        className="h-9 rounded-md border border-[#E2E8F0] bg-white px-2 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68] disabled:cursor-not-allowed disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]"
                      >
                        {ADMIN_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          isActive
                            ? "bg-[#DCFCE7] text-[#15803D]"
                            : "bg-[#FEE2E2] text-[#B91C1C]"
                        }`}
                      >
                        {isActive ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={locked}
                        title={locked ? reason : undefined}
                        onClick={() => handleSetActive(user, !isActive)}
                        className={`h-8 rounded-md border px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                          isActive
                            ? "border-[#E2E8F0] text-[#B91C1C] hover:bg-[#FEF2F2]"
                            : "border-[#E2E8F0] text-[#15803D] hover:bg-[#F0FDF4]"
                        }`}
                      >
                        {isActive ? "Deactivate" : "Reactivate"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <Modal title="Add Transport Office Account" onClose={() => setShowCreate(false)}>
          <CreateAccountForm
            existingEmails={users.map((user) => user.email.toLowerCase())}
            onSubmit={(user) => {
              add(user);
              setShowCreate(false);
            }}
            onCancel={() => setShowCreate(false)}
          />
        </Modal>
      )}
    </div>
  );
}

function CreateAccountForm({
  existingEmails,
  onSubmit,
  onCancel,
}: {
  existingEmails: string[];
  onSubmit: (user: UserAccount) => void;
  onCancel: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("TransportInCharge");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName || !trimmedEmail) {
      setError("Name and email are required.");
      return;
    }

    if (existingEmails.includes(trimmedEmail)) {
      setError("An account with this email already exists.");
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    // Appointed internally by a Super Admin (FRD §2) — skips the OTP
    // flow entirely, unlike applicant self-registration. isActive
    // defaults true (see useUsers.ts's migration for why it's optional
    // at the type level rather than always-present here explicitly).
    onSubmit({
      id: crypto.randomUUID(),
      email: trimmedEmail,
      role,
      fullName: trimmedName,
      passwordHash: hashPassword(password),
      isVerified: true,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-[#1E293B]">Full Name</span>
        <input
          type="text"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          className="h-10 rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#0F2747] focus:ring-2 focus:ring-[#0F2747]"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-[#1E293B]">Email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@sust.edu"
          className="h-10 rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#0F2747] focus:ring-2 focus:ring-[#0F2747]"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-[#1E293B]">Role</span>
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as AdminRole)}
          className="h-10 rounded-md border border-[#E2E8F0] bg-white px-3 text-sm text-[#1E293B] outline-none focus:border-[#0F2747] focus:ring-2 focus:ring-[#0F2747]"
        >
          {ADMIN_ROLES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-[#1E293B]">
          Initial Password
        </span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          className="h-10 rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#0F2747] focus:ring-2 focus:ring-[#0F2747]"
        />
      </label>

      {error && (
        <p className="rounded-md border border-[#FEE2E2] bg-[#FEE2E2] px-3 py-2 text-sm text-[#B91C1C]">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-md border border-[#E2E8F0] bg-white px-4 text-sm font-medium text-[#334E68] hover:bg-[#F8FAFC]"
        >
          Cancel
        </button>

        <button
          type="submit"
          className="h-9 rounded-md bg-[#0F2747] px-4 text-sm font-medium text-white hover:bg-[#334E68]"
        >
          Create Account
        </button>
      </div>
    </form>
  );
}
