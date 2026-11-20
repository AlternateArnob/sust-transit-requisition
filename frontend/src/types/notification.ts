export type NotificationType =
  | "New Requisition"
  | "Resubmission"
  | "Recommendation"
  | "Conflict"
  // Types used by the requisition workflow notifications (Transport
  // In-Charge, Administrator and applicant).
  | "Forwarded to Administrator"
  | "Sent Back to Applicant"
  | "Trip Approved"
  | "Trip Rejected"
  | "Sent Back to Transport In Charge"
  // Account activation/deactivation/role-change (FRD §24).
  | "Account Status Changed";

export interface AppNotification {
  id: string;
  type: NotificationType;
  message: string;
  timestamp: string;
  linkType: "requisition" | "conflict" | "user";
  linkId: string;
  /**
   * Recipient routing. When set, this notification only shows up
   * for the listed user; when unset (older stored records), it's
   * treated as a global notification that everyone sees.
   */
  recipientUserId?: string;
  isRead: boolean;
}
