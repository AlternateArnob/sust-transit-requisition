import { useState } from "react";

import useAuth from "../hooks/useAuth";
import useUsers from "../hooks/useUsers";
import useNotifications from "../hooks/useNotifications";

import Modal from "../components/Modal";
import { ADMIN_ROLES, type AdminRole } from "../utils/permissions";
import { buildAccountStatusNotification } from "../utils/notificationUtils";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../utils/passwordUtils";
import { DEPARTMENTS, OFFICES } from "../data/sustDirectory";
import type { UserAccount, UserRole } from "../types";

/**
 * Corrections Step 4+5 (answered together — Step 5's scoping question
 * was "manage every registered user, not just Transport Office
 * accounts", which reshapes Step 4's Edit/Delete rules, so building
 * them as one page instead of two passes).
 *
 * Step 5: the account list is no longer filtered to the 3 Transport
 * Office roles — every UserAccount shows up, Applicant and
 * DepartmentHead included.
 *
 * Step 4: standalone Deactivate/Reactivate button and inline role
 * <select> are gone, replaced by one "Edit" flow per row (name, email,
 * mobile, role, active status, submitted together). Delete is new and
 * deliberately narrow — see canDelete() below.
 *
 * Scoping choice made here, not explicitly asked for either way: "Add
 * Account" (creation) stays scoped to the 3 Transport Office roles, as
 * it was in Phase 9. Broadening *management* to every account doesn't
 * imply this console should also fabricate brand-new Applicant/
 * DepartmentHead accounts — those still come from their own
 * registration/appointment flows elsewhere in the app. Flagging this
 * as an inference, not a re-confirmed instruction.
 */

const ALL_ROLES: UserRole[] = [
  "Applicant",
  "DepartmentHead",
  "TransportInCharge",
  "TransportAdministrator",
  "SuperAdmin",
];

export default function UsersPage() {
  const { currentUser } = useAuth();
  const { users, add, update, remove } = useUsers();
  const { addNotification } = useNotifications();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<UserAccount | null>(null);

  const allUsers = [...users].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );

  const activeSuperAdminCount = allUsers.filter(
    (user) => user.role === "SuperAdmin" && user.isActive !== false,
  ).length;

  /**
   * §4 decision A — block, don't just confirm. Applies to any account,
   * not just the 3 Transport Office roles, since the underlying risks
   * (self-lockout, zero active Super Admins) don't care what role the
   * *other* accounts in the list happen to be.
   */
  function rowLockFor(user: UserAccount): {
    locked: boolean;
    reason?: string;
  } {
    if (user.id === currentUser?.id) {
      return {
        locked: true,
        reason: "You can't change your own role or active status here.",
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

  /**
   * Delete is restricted to Super Admin-role rows, and only extended
   * (never introduced) to every role by the same reasoning the original
   * plan gave for Transport In Charge/Administrator: Applicant and
   * DepartmentHead accounts are just as entangled in historical output
   * (every requisition references its requester; recommendations
   * reference their DepartmentHead) as TIC/TA are in duty slips and
   * confirmation slips. Only Super Admin accounts don't produce that
   * kind of downstream reference, so only they're ever deletable — and
   * never your own.
   */
  function canDelete(user: UserAccount): boolean {
    return user.role === "SuperAdmin" && user.id !== currentUser?.id;
  }

  function handleDelete(user: UserAccount) {
    const confirmed = window.confirm(
      `Delete ${user.fullName ?? user.email}'s account? This cannot be undone.`,
    );
    if (!confirmed) return;
    remove(user.id);
  }

  function handleSaveEdit(
    user: UserAccount,
    patch: {
      fullName: string;
      email: string;
      mobile?: string;
      role: UserRole;
      isActive: boolean;
      headOfDepartment?: string;
      headOfOffice?: string;
    },
  ) {
    const roleChanged = patch.role !== user.role;
    const activeChanged = patch.isActive !== (user.isActive !== false);

    update(user.id, patch);

    if (roleChanged || activeChanged) {
      const parts: string[] = [];
      if (activeChanged) {
        parts.push(
          patch.isActive ? "reactivated" : "deactivated",
        );
      }
      if (roleChanged) {
        parts.push(`role changed to ${patch.role}`);
      }

      addNotification(
        buildAccountStatusNotification(
          user.id,
          `Your account was ${parts.join(" and ")} by a Super Admin.`,
        ),
      );
    }

    setEditing(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#1E293B]">
            Registered Accounts
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Every registered account — edit name, email, mobile, role, or
            active status. Delete is only available for other Super Admin
            accounts.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="h-9 rounded-md bg-[#0F2747] px-4 text-sm font-medium text-white hover:bg-[#334E68]"
        >
          Add Transport Office Account
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
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {allUsers.map((user, index) => {
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
                    <td className="px-4 py-3 text-[#64748B]">{user.role}</td>
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
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditing(user)}
                          className="h-8 rounded-md border border-[#E2E8F0] px-3 text-xs font-medium text-[#334E68] hover:bg-[#F8FAFC]"
                        >
                          Edit
                        </button>

                        {canDelete(user) && (
                          <button
                            type="button"
                            onClick={() => handleDelete(user)}
                            className="h-8 rounded-md border border-[#E2E8F0] px-3 text-xs font-medium text-[#B91C1C] hover:bg-[#FEF2F2]"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <Modal
          title={`Edit ${editing.fullName ?? editing.email}`}
          onClose={() => setEditing(null)}
        >
          <EditAccountForm
            user={editing}
            lock={rowLockFor(editing)}
            existingEmails={users
              .filter((user) => user.id !== editing.id)
              .map((user) => user.email.toLowerCase())}
            onSubmit={(patch) => handleSaveEdit(editing, patch)}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}

      {showCreate && (
        <Modal
          title="Add Transport Office Account"
          onClose={() => setShowCreate(false)}
        >
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

function EditAccountForm({
  user,
  lock,
  existingEmails,
  onSubmit,
  onCancel,
}: {
  user: UserAccount;
  lock: { locked: boolean; reason?: string };
  existingEmails: string[];
  onSubmit: (patch: {
    fullName: string;
    email: string;
    mobile?: string;
    role: UserRole;
    isActive: boolean;
    headOfDepartment?: string;
    headOfOffice?: string;
  }) => void;
  onCancel: () => void;
}) {
  const [fullName, setFullName] = useState(user.fullName ?? "");
  const [email, setEmail] = useState(user.email);
  const [mobile, setMobile] = useState(user.mobile ?? "");
  const [role, setRole] = useState<UserRole>(user.role);
  const [isActive, setIsActive] = useState(user.isActive !== false);
  const [headOfDepartment, setHeadOfDepartment] = useState(
    user.headOfDepartment ?? "",
  );
  const [headOfOffice, setHeadOfOffice] = useState(user.headOfOffice ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedMobile = mobile.trim();

    if (!trimmedName || !trimmedEmail) {
      setError("Name and email are required.");
      return;
    }

    if (existingEmails.includes(trimmedEmail)) {
      setError("Another account is already using this email.");
      return;
    }

    onSubmit({
      fullName: trimmedName,
      email: trimmedEmail,
      mobile: trimmedMobile || undefined,
      role,
      isActive,
      // Fix 7 — the fields that actually determine recommendation
      // routing (findDepartmentHeadsForRequisition matches a
      // requisition's department/office against these). Only meaningful
      // for DepartmentHead accounts, but harmless to carry through
      // otherwise — nothing reads them for any other role.
      headOfDepartment: headOfDepartment || undefined,
      headOfOffice: headOfOffice || undefined,
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
          className="h-10 rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#0F2747] focus:ring-2 focus:ring-[#0F2747]"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-[#1E293B]">
          Mobile Number
        </span>
        <input
          type="tel"
          value={mobile}
          onChange={(event) => setMobile(event.target.value)}
          placeholder="01XXXXXXXXX"
          className="h-10 rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#0F2747] focus:ring-2 focus:ring-[#0F2747]"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-[#1E293B]">Role</span>
        <select
          value={role}
          disabled={lock.locked}
          title={lock.locked ? lock.reason : undefined}
          onChange={(event) => setRole(event.target.value as UserRole)}
          className="h-10 rounded-md border border-[#E2E8F0] bg-white px-3 text-sm text-[#1E293B] outline-none focus:border-[#0F2747] focus:ring-2 focus:ring-[#0F2747] disabled:cursor-not-allowed disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]"
        >
          {ALL_ROLES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      {role === "DepartmentHead" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-[#1E293B]">
              Head of Department
            </span>
            <select
              value={headOfDepartment}
              onChange={(event) => setHeadOfDepartment(event.target.value)}
              className="h-10 rounded-md border border-[#E2E8F0] bg-white px-3 text-sm text-[#1E293B] outline-none focus:border-[#0F2747] focus:ring-2 focus:ring-[#0F2747]"
            >
              <option value="">— none —</option>
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-[#1E293B]">
              Head of Office
            </span>
            <select
              value={headOfOffice}
              onChange={(event) => setHeadOfOffice(event.target.value)}
              className="h-10 rounded-md border border-[#E2E8F0] bg-white px-3 text-sm text-[#1E293B] outline-none focus:border-[#0F2747] focus:ring-2 focus:ring-[#0F2747]"
            >
              <option value="">— none —</option>
              {OFFICES.map((off) => (
                <option key={off} value={off}>
                  {off}
                </option>
              ))}
            </select>
          </label>

          <p className="text-xs text-[#64748B] sm:col-span-2">
            Set one of these to determine which requisitions route to this
            person for recommendation — a requisition's Department or
            Office must match exactly for it to reach them.
          </p>
        </div>
      ) : null}

      <div className="flex items-center justify-between rounded-md border border-[#E2E8F0] px-3 py-2">
        <span className="text-sm font-medium text-[#1E293B]">
          Account Active
        </span>
        <button
          type="button"
          disabled={lock.locked}
          title={lock.locked ? lock.reason : undefined}
          onClick={() => setIsActive((current) => !current)}
          className={`h-8 rounded-md border px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
            isActive
              ? "border-[#E2E8F0] text-[#15803D] hover:bg-[#F0FDF4]"
              : "border-[#E2E8F0] text-[#B91C1C] hover:bg-[#FEF2F2]"
          }`}
        >
          {isActive ? "Active" : "Deactivated"}
        </button>
      </div>

      {lock.locked && (
        <p className="text-xs text-[#94A3B8]">{lock.reason}</p>
      )}

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
          Save Changes
        </button>
      </div>
    </form>
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
