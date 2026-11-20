import { buttonClass } from "@/shared/ui/buttonStyles";
import type { UserAccount } from "@/types";

interface UsersTableProps {
  users: UserAccount[];
  currentUserId?: string;
  canDelete: (user: UserAccount) => boolean;
  onEdit: (user: UserAccount) => void;
  onDelete: (user: UserAccount) => void;
}

export default function UsersTable({
  users,
  currentUserId,
  canDelete,
  onEdit,
  onDelete,
}: UsersTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, index) => {
              const isActive = user.isActive !== false;

              return (
                <tr
                  key={user.id}
                  className={`border-t border-border ${index % 2 === 1 ? "bg-surface" : "bg-white"}`}
                >
                  <td className="px-4 py-3 font-medium text-text">
                    {user.fullName ?? "—"}
                    {user.id === currentUserId && (
                      <span className="ml-2 text-xs font-normal text-text-muted">(you)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-muted">{user.email}</td>
                  <td className="px-4 py-3 text-text-muted">{user.role}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                        isActive ? "bg-success-bg text-success" : "bg-error-bg text-error"
                      }`}
                    >
                      {isActive ? "Active" : "Deactivated"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(user)}
                        className="h-8 rounded-md border border-border px-3 text-xs font-medium text-secondary hover:bg-surface"
                      >
                        Edit
                      </button>

                      {canDelete(user) && (
                        <button
                          type="button"
                          onClick={() => onDelete(user)}
                          className={buttonClass("danger", "sm")}
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
  );
}
