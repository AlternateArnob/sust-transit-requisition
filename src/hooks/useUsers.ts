import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEYS } from "../data/storageKeys";
import { hashPassword } from "../utils/passwordUtils";
import type { UserAccount } from "../types";

const STORAGE_KEY = STORAGE_KEYS.users;

/**
 * Phase 0 (admin module) — dev-only seed accounts, one per Transport
 * Office role, so all three role-specific flows are reachable locally
 * without a real registration path. Same shared password for all three
 * to keep local testing simple; never used outside dev seed data.
 */
const SEED_PASSWORD = "Admin@123";

const SEED_ACCOUNTS: ReadonlyArray<{
  id: string;
  email: string;
  role: UserAccount["role"];
  fullName: string;
}> = [
  {
    id: "USR-SEED-TIC",
    email: "transport-in-charge@sust.edu",
    role: "TransportInCharge",
    fullName: "Transport In Charge (Seed)",
  },
  {
    id: "USR-SEED-TA",
    email: "transport-admin@sust.edu",
    role: "TransportAdministrator",
    fullName: "Transport Administrator (Seed)",
  },
  {
    id: "USR-SEED-SUPERADMIN",
    email: "superadmin@sust.edu",
    role: "SuperAdmin",
    fullName: "Super Admin (Seed)",
  },
];

function readUsers(): UserAccount[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  try {
    const parsed: UserAccount[] = JSON.parse(stored);
    // Phase 9 migration — pre-Phase-9 records have no isActive field at
    // all; treat that as "always was active" rather than leaving it
    // undefined, so every other file can rely on it being a real boolean.
    return parsed.map((user) => ({
      ...user,
      isActive: user.isActive ?? true,
    }));
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

function ensureSeedAdminAccounts(users: UserAccount[]): UserAccount[] {
  const missing = SEED_ACCOUNTS.filter(
    (seed) =>
      !users.some((user) => user.email.toLowerCase() === seed.email),
  );
  if (missing.length === 0) return users;

  const createdAt = new Date().toISOString();
  const newAccounts: UserAccount[] = missing.map((seed) => ({
    id: seed.id,
    email: seed.email,
    role: seed.role,
    fullName: seed.fullName,
    passwordHash: hashPassword(SEED_PASSWORD),
    isVerified: true,
    isActive: true,
    createdAt,
  }));

  const next = [...users, ...newAccounts];
  writeUsers(next);
  return next;
}

export default function useUsers() {
  const [users, setUsers] = useState<UserAccount[]>(() =>
    ensureSeedAdminAccounts(readUsers()),
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
