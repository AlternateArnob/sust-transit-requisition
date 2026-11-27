import { v4 as uuid } from "uuid";
import type { NotificationLinkType, NotificationType } from "../config/constants.js";
import type { DbExecutor } from "../db/transaction.js";

// Part 1 §13. Every notification has exactly one recipient and is created inside the transaction
// of the change that caused it. Step 19 adds the multi-recipient helpers and the read API.

export interface NewNotification {
  recipientUserId: string;
  type: NotificationType;
  message: string;
  linkType: NotificationLinkType;
  linkId: string;
  /** A second insert with the same key is ignored (idempotent retries). */
  dedupeKey?: string;
}

const MAX_MESSAGE_LENGTH = 1000;

export async function notifyUser(
  executor: DbExecutor,
  notification: NewNotification,
): Promise<void> {
  const row = {
    id: uuid(),
    recipient_user_id: notification.recipientUserId,
    type: notification.type,
    message: notification.message.slice(0, MAX_MESSAGE_LENGTH),
    link_type: notification.linkType,
    link_id: notification.linkId,
    dedupe_key: notification.dedupeKey ?? null,
  };
  const query = executor("notifications").insert(row);
  if (notification.dedupeKey) await query.onConflict("dedupe_key").ignore();
  else await query;
}
