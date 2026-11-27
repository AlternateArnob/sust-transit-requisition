import type { UserRole } from "../config/constants.js";

export interface AccountStatusChange {
  /** The `isActive` flag changed. */
  activeChanged: boolean;
  /** The value after the change (only used when `activeChanged`). */
  isActive: boolean;
  /** The role changed. */
  roleChanged: boolean;
  /** The role after the change (only used when `roleChanged`). */
  role: UserRole;
}

/**
 * Part 1 §12.4 / §13: "Your account was {reactivated|deactivated}[ and ]role changed to {role} by a
 * Super Admin." Port of `UsersPage.handleSaveEdit`. Returns `null` when neither thing changed.
 */
export function buildAccountStatusMessage(change: AccountStatusChange): string | null {
  const parts: string[] = [];
  if (change.activeChanged) parts.push(change.isActive ? "reactivated" : "deactivated");
  if (change.roleChanged) parts.push(`role changed to ${change.role}`);
  if (parts.length === 0) return null;
  return `Your account was ${parts.join(" and ")} by a Super Admin.`;
}
