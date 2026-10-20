import type {
  AppNotification,
  NotificationType,
  Requisition,
  UserAccount,
} from "../types";

/**
 * Phase 5 — match a requisition's department/office against every
 * DepartmentHead's scope. We compare trimmed + lowercased so minor
 * punctuation/whitespace differences don't false-negative the match.
 */
function scopeMatches(department: string | undefined, head: UserAccount): boolean {
  const dept = department?.trim().toLowerCase();
  if (!dept) return false;

  const headDept = head.headOfDepartment?.trim().toLowerCase();
  const headOffice = head.headOfOffice?.trim().toLowerCase();

  return Boolean(
    (headDept && dept === headDept) || (headOffice && dept === headOffice),
  );
}

/**
 * Return every verified DepartmentHead whose head-of-department or
 * head-of-office matches the requisition's department. Returns `[]` if
 * no head exists for that scope — callers must still notify the Admin
 * so the requisition isn't dropped on the floor.
 */
export function findDepartmentHeadsForRequisition(
  requisition: Pick<Requisition, "department">,
  users: UserAccount[],
): UserAccount[] {
  return users.filter(
    (user) =>
      user.role === "DepartmentHead" && user.isVerified && scopeMatches(requisition.department, user),
  );
}

/**
 * Backfilled alongside findDepartmentHeadsForRequisition, above — these
 * two are unscoped versions of the same idea for the Transport Office
 * roles (no department/office matching needed, everyone in the role
 * gets notified). `user.isActive !== false` treats the field as opt-in:
 * true for every account until Phase 9 actually introduces it, so this
 * doesn't silently drop pre-Phase-9 accounts that have no such field yet.
 */
export function findTransportInCharge(users: UserAccount[]): UserAccount[] {
  return users.filter(
    (user) =>
      user.role === "TransportInCharge" &&
      user.isVerified &&
      user.isActive !== false,
  );
}

export function findTransportAdministrators(
  users: UserAccount[],
): UserAccount[] {
  return users.filter(
    (user) =>
      user.role === "TransportAdministrator" &&
      user.isVerified &&
      user.isActive !== false,
  );
}

/**
 * Notify the requester of a single requisition-level event (approved,
 * rejected, sent back). One notification, not a fan-out list, since
 * there's exactly one recipient — unlike buildRequisitionNotifications
 * above, which is for notifying a whole role.
 */
export function buildApplicantNotification(
  requisition: Requisition,
  args: { type: NotificationType; message: string },
): AppNotification {
  return {
    id: crypto.randomUUID(),
    type: args.type,
    message: args.message,
    timestamp: new Date().toISOString(),
    linkType: "requisition",
    linkId: requisition.id,
    recipientUserId: requisition.requesterId,
    isRead: false,
  };
}

/**
 * Phase 9 (FRD §24) — notify the affected account directly on
 * activate/deactivate/role-change. For a deactivation the account can't
 * sign in to see it right away, but it's still correct to record —
 * visible on reactivation, or to anyone with access to their history
 * (Phase 8's "don't discard history" reasoning applies here too).
 */
export function buildAccountStatusNotification(
  userId: string,
  message: string,
): AppNotification {
  return {
    id: crypto.randomUUID(),
    type: "Account Status Changed",
    message,
    timestamp: new Date().toISOString(),
    linkType: "user",
    linkId: userId,
    recipientUserId: userId,
    isRead: false,
  };
}

/**
 * Notify every matching DepartmentHead about a requisition event. Used
 * by RequisitionForm (new + resubmit) and ApplyRequisitionPage (admin
 * new). One notification per recipient, each stamped with that user's
 * id so the bell's per-user filter works.
 */
export function buildRequisitionNotifications(
  recipients: UserAccount[],
  args: {
    requisition: Requisition;
    type: NotificationType;
    message: string;
  },
): AppNotification[] {
  return recipients.map<AppNotification>((recipient) => ({
    id: crypto.randomUUID(),
    type: args.type,
    message: args.message,
    timestamp: new Date().toISOString(),
    linkType: "requisition",
    linkId: args.requisition.id,
    recipientUserId: recipient.id,
    isRead: false,
  }));
}
