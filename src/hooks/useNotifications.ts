import { useEffect, useState } from "react";
import type { AppNotification } from "../types";

const STORAGE_KEY = "sust-transit-notifications";

export default function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return [];
    }

    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  }, [notifications]);

  function addNotification(notification: AppNotification) {
    setNotifications((current) => [notification, ...current]);
  }

  function markAsRead(notificationId: string) {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? { ...notification, isRead: true }
          : notification,
      ),
    );
  }

  function markAllAsRead() {
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, isRead: true })),
    );
  }

  const unreadCount = notifications.filter(
    (notification) => !notification.isRead,
  ).length;

  return {
    notifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    unreadCount,
  };
}