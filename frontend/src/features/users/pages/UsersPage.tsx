import { useState } from "react";

import useAuth from "@/features/auth/hooks/useAuth";
import useUsers from "@/features/users/hooks/useUsers";
import useNotifications from "@/features/notifications/hooks/useNotifications";

import Modal from "@/shared/ui/Modal";
import { buildAccountStatusNotification } from "@/features/notifications/utils/notificationUtils";
import type { UserAccount, UserRole } from "@/types";
import CreateAccountForm from "@/features/users/components/CreateAccountForm";
import EditAccountForm from "@/features/users/components/EditAccountForm";
import UsersTable from "@/features/users/components/UsersTable";
import { buttonClass } from "@/shared/ui/buttonStyles";
import PageTitle from "@/shared/ui/PageTitle";

/**
 * Account management console: lists every registered user, not just
 * Transport Office accounts.
 *
 * The account list is no longer filtered to the 3 Transport
 * Office roles — every UserAccount shows up, Applicant and
 * DepartmentHead included.
 *
 * Standalone Deactivate/Reactivate button and inline role
 * <select> are gone, replaced by one "Edit" flow per row (name, email,
 * mobile, role, active status, submitted together). Delete is new and
 * deliberately narrow — see canDelete() below.
 *
 * Scoping choice made here, not explicitly asked for either way: "Add
 * Account" (creation) stays scoped to the 3 Transport Office roles, as
 * it always has been. Broadening *management* to every account doesn't
 * imply this console should also fabricate brand-new Applicant/
 * DepartmentHead accounts — those still come from their own
 * registration/appointment flows elsewhere in the app. Flagging this
 * as an inference, not a re-confirmed instruction.
 */

export default function UsersPage() {
  const { currentUser } = useAuth();
  const { users, add, update, remove } = useUsers();
  const { addNotification } = useNotifications();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<UserAccount | null>(null);

  const allUsers = [...users].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const activeSuperAdminCount = allUsers.filter(
    (user) => user.role === "SuperAdmin" && user.isActive !== false,
  ).length;

  /**
   * Block, don't just confirm. Applies to any account,
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
      user.role === "SuperAdmin" && user.isActive !== false && activeSuperAdminCount <= 1;

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
        parts.push(patch.isActive ? "reactivated" : "deactivated");
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
        <PageTitle
          title="Registered Accounts"
          subtitle="Every registered account — edit name, email, mobile, role, or active status. Delete is only available for other Super Admin accounts."
        />

        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className={buttonClass("primary")}
        >
          Add Transport Office Account
        </button>
      </div>

      <UsersTable
        users={allUsers}
        currentUserId={currentUser?.id}
        canDelete={canDelete}
        onEdit={setEditing}
        onDelete={handleDelete}
      />

      {editing && (
        <Modal title={`Edit ${editing.fullName ?? editing.email}`} onClose={() => setEditing(null)}>
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
