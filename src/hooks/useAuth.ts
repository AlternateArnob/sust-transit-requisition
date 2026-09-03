import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEYS } from "../data/storageKeys";
import useUsers from "./useUsers";
import type { UserAccount } from "../types";

const SESSION_KEY = STORAGE_KEYS.session;

function readSession(): string | null {
  const stored = localStorage.getItem(SESSION_KEY);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    return typeof parsed === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function writeSession(userId: string | null): void {
  if (userId === null) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(userId));
}

export default function useAuth() {
  const { users, findById } = useUsers();
  const [activeUserId, setActiveUserId] = useState<string | null>(() =>
    readSession(),
  );

  useEffect(() => {
    writeSession(activeUserId);
  }, [activeUserId]);

  const currentUser: UserAccount | null = activeUserId
    ? findById(activeUserId) ?? null
    : null;

  const login = useCallback((userId: string) => {
    setActiveUserId(userId);
  }, []);

  const logout = useCallback(() => {
    setActiveUserId(null);
  }, []);

  const refreshSession = useCallback(() => {
    setActiveUserId((current) => {
      if (current && !findById(current)) {
        return null;
      }
      return current;
    });
  }, [findById]);

  return {
    users,
    currentUser,
    activeUserId,
    isAuthenticated: currentUser !== null,
    isVerified: currentUser?.isVerified ?? false,
    login,
    logout,
    refreshSession,
  };
}
