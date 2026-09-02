export type NotificationType = "New Requisition" | "Conflict";

export interface AppNotification {
  id: string;
  type: NotificationType;
  message: string;
  timestamp: string;
  linkType: "requisition" | "conflict";
  linkId: string;
  isRead: boolean;
}
