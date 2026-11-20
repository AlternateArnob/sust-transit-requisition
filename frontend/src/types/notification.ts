export type NotificationType =
  | "New Requisition"
  | "Resubmission"
  | "Recommendation"
  | "Conflict"
  // The five below are referenced by RequisitionsPage.tsx (added when
  // your Phase 7 patch wired up the TIC/Administrator/applicant
  // notification calls) but were missing from this type — the patch you
  // uploaded didn't include the corresponding types/notificationUtils
  // change, which left the project not type-checking. Backfilled here
  // so those call sites actually compile; the wording matches exactly
  // what RequisitionsPage.tsx already passes as `type`. If your actual
  // local Phase 7 work already has these (and the upload just missed
  // the file), treat this commit as a no-op / drop it.
  | "Forwarded to Administrator"
  | "Sent Back to Applicant"
  | "Trip Approved"
  | "Trip Rejected"
  | "Sent Back to Transport In Charge"
  // Phase 9 — account activation/deactivation/role-change (FRD §24).
  | "Account Status Changed";

export interface AppNotification {
  id: string;
  type: NotificationType;
  message: string;
  timestamp: string;
  linkType: "requisition" | "conflict" | "user";
  linkId: string;
  /**
   * Phase 5 — recipient routing. When set, this notification only shows up
   * for the listed user; when unset (older records pre-Phase 5), it's
   * treated as a global notification that everyone sees.
   */
  recipientUserId?: string;
  isRead: boolean;
}
