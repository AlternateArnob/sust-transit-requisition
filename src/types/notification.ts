export type NotificationType =
  | "New Requisition"
  | "Resubmission"
  | "Recommendation"
  | "Conflict";

export interface AppNotification {
  id: string;
  type: NotificationType;
  message: string;
  timestamp: string;
  linkType: "requisition" | "conflict";
  linkId: string;
  /**
   * Phase 5 — recipient routing. When set, this notification only shows up
   * for the listed user; when unset (older records pre-Phase 5), it's
   * treated as a global notification that everyone sees.
   */
  recipientUserId?: string;
  isRead: boolean;
}
