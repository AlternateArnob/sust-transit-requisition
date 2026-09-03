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
