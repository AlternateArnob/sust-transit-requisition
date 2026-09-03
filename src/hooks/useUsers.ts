import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEYS } from "../data/storageKeys";
import { hashPassword } from "../utils/passwordUtils";
import type { UserAccount } from "../types";

const STORAGE_KEY = STORAGE_KEYS.users;

const SEED_ADMIN_ID = "USR-SEED-ADMIN";
const SEED_ADMIN_EMAIL = "admin@sust.edu";
/** Dev-only default password for the seeded admin account. Anyone testing
 *  the admin flows locally can log in with admin@sust.edu / this password. */
const SEED_ADMIN_PASSWORD = "Admin@123";

function readUsers(): UserAccount[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  try {
    return JSON.parse(stored);
  } catch (error) {
    console.error(`Failed to parse ${STORAGE_KEY}`, error);
    return [];
  }
}

function writeUsers(users: UserAccount[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  } catch (error) {
    console.error(`Failed to write ${STORAGE_KEY}`, error);
  }
}

function ensureSeedAdmin(users: UserAccount[]): UserAccount[] {
  const hasAdmin = users.some(
    (user) => user.email.toLowerCase() === SEED_ADMIN_EMAIL,
  );
  if (hasAdmin) return users;

  const seedAdmin: UserAccount = {
    id: SEED_ADMIN_ID,
    email: SEED_ADMIN_EMAIL,
    role: "Admin",
    fullName: "System Administrator",
    passwordHash: hashPassword(SEED_ADMIN_PASSWORD),
    isVerified: true,
    createdAt: new Date().toISOString(),
  };

  const next = [...users, seedAdmin];
  writeUsers(next);
  return next;
}

export default function useUsers() {
  const [users, setUsers] = useState<UserAccount[]>(() =>
    ensureSeedAdmin(readUsers()),
  );

  useEffect(() => {
    writeUsers(users);
  }, [users]);

  const add = useCallback((user: UserAccount) => {
    setUsers((current) => [...current, user]);
  }, []);

  const update = useCallback((id: string, patch: Partial<UserAccount>) => {
    setUsers((current) =>
      current.map((user) => (user.id === id ? { ...user, ...patch } : user)),
    );
  }, []);

  const remove = useCallback((id: string) => {
    setUsers((current) => current.filter((user) => user.id !== id));
  }, []);

  const findByEmail = useCallback(
    (email: string) => {
      const normalised = email.trim().toLowerCase();
      return users.find((user) => user.email.toLowerCase() === normalised);
    },
    [users],
  );

  const findById = useCallback(
    (id: string) => users.find((user) => user.id === id),
    [users],
  );

  const markVerified = useCallback((id: string) => {
    setUsers((current) =>
      current.map((user) =>
        user.id === id ? { ...user, isVerified: true } : user,
      ),
    );
  }, []);

  const setPassword = useCallback((id: string, password: string) => {
    const passwordHash = hashPassword(password);
    setUsers((current) =>
      current.map((user) => (user.id === id ? { ...user, passwordHash } : user)),
    );
    return passwordHash;
  }, []);

  return {
    users,
    setUsers,
    add,
    update,
    remove,
    findByEmail,
    findById,
    markVerified,
    setPassword,
  };
}
