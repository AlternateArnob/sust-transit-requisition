import { useEffect, useMemo, useState } from "react";

import { STORAGE_KEYS } from "@/shared/config/storageKeys";
import useAuth from "@/features/auth/hooks/useAuth";

import type { AppNotification } from "@/types";

const STORAGE_KEY = STORAGE_KEYS.notifications;

/**
 * Global notification store with per-user filtering.
 *
 * Notifications are still stored as a single array under one
 * localStorage key, but each entry now carries an optional
 * `recipientUserId`. Entries without one are treated as "global" (shown
 * to everyone — kept this way so legacy data saved before recipient routing still appears
 * for both Admins and DepartmentHeads during the upgrade). New
 * notifications must always set `recipientUserId` so they only show up
 * for the intended recipient.
 *
 * This hook MUST be called from a component that's already inside an
 * `useAuth` provider. NotificationBell is, so the indirection is fine.
 */
export default function useNotifications() {
  const { currentUser } = useAuth();

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return [];
    }

    try {
      const parsed: AppNotification[] = JSON.parse(stored);
      // Conflict notifications were removed; drop any saved ones so they
      // don't show up as links to a page that no longer exists.
      return parsed.filter((notification) => (notification.linkType as string) !== "conflict");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  }, [notifications]);

  const visibleNotifications: AppNotification[] = useMemo(() => {
    if (!currentUser) return [];
    const userId = currentUser.id;
    return notifications.filter(
      (notification) => !notification.recipientUserId || notification.recipientUserId === userId,
    );
  }, [notifications, currentUser]);

  const unreadCount = visibleNotifications.filter((notification) => !notification.isRead).length;

  /**
   * For DepartmentHeads only: count of `requisition`-linked
   * notifications that aren't read yet. Used to badge the navbar so a
   * recommender can see "you have N pending recommendations" without
   * having to open the bell first.
   *
   * Admins don't need this — the bell's running `unreadCount` already
   * covers them, and they don't have a separate "inbox".
   */
  const recommendationsCount = visibleNotifications.filter(
    (notification) =>
      !notification.isRead &&
      notification.linkType === "requisition" &&
      (notification.type === "New Requisition" || notification.type === "Resubmission"),
  ).length;

  function addNotification(notification: AppNotification) {
    setNotifications((current) => [notification, ...current]);
  }

  function markAsRead(notificationId: string) {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId ? { ...notification, isRead: true } : notification,
      ),
    );
  }

  function markAllAsRead() {
    if (!currentUser) return;
    const userId = currentUser.id;
    setNotifications((current) =>
      current.map((notification) => {
        // Don't touch notifications addressed to someone else.
        if (notification.recipientUserId && notification.recipientUserId !== userId) {
          return notification;
        }
        return { ...notification, isRead: true };
      }),
    );
  }

  return {
    notifications: visibleNotifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    unreadCount,
    recommendationsCount,
  };
}
