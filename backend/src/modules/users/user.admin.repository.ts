import type { UserRole } from "../../config/constants.js";
import { db } from "../../db/knex.js";
import type { DbExecutor } from "../../db/transaction.js";
import { escapeLike, offsetFor } from "../../http/pagination.js";
import { toUserRecord, type UserRecord, type UserRow } from "./user.repository.js";

// Queries used only by the Super Admin account management (Part 1 §12.4).

export const USER_SORT_COLUMNS = {
  createdAt: "created_at",
  fullName: "full_name",
  email: "email",
  role: "role",
} as const;
export type UserSortKey = keyof typeof USER_SORT_COLUMNS;

export interface UserListFilter {
  role?: UserRole;
  isActive?: boolean;
  q?: string;
  sort: UserSortKey;
  direction: "asc" | "desc";
  page: number;
  pageSize: number;
}

export async function listUsers(
  filter: UserListFilter,
  executor: DbExecutor = db,
): Promise<{ rows: UserRecord[]; total: number }> {
  const base = executor<UserRow>("users");
  if (filter.role) base.where("role", filter.role);
  if (filter.isActive !== undefined) base.where("is_active", filter.isActive ? 1 : 0);
  if (filter.q) {
    const like = `%${escapeLike(filter.q)}%`;
    base.where((qb) =>
      qb
        .whereRaw("email LIKE ? ESCAPE '\\\\'", [like])
        .orWhereRaw("full_name LIKE ? ESCAPE '\\\\'", [like])
        .orWhereRaw("mobile LIKE ? ESCAPE '\\\\'", [like]),
    );
  }

  const [{ total }] = (await base.clone().count({ total: "*" })) as [{ total: number | string }];
  const rows = await base
    .clone()
    .select("*")
    // `id` makes the order total, so paging never repeats or skips a row.
    .orderBy([
      { column: USER_SORT_COLUMNS[filter.sort], order: filter.direction },
      { column: "id" },
    ])
    .limit(filter.pageSize)
    .offset(offsetFor(filter.page, filter.pageSize));

  return { rows: rows.map(toUserRecord), total: Number(total) };
}

/**
 * Locks every active Super Admin row, in id order. Two requests that could each remove "another"
 * Super Admin therefore run one after the other and the second sees the true count.
 */
export async function lockActiveSuperAdmins(executor: DbExecutor): Promise<string[]> {
  const rows = await executor<UserRow>("users")
    .where({ role: "SuperAdmin", is_active: 1 })
    .select("id")
    .orderBy("id")
    .forUpdate();
  return rows.map((row) => row.id);
}

export async function emailBelongsToOtherUser(
  email: string,
  exceptUserId: string,
  executor: DbExecutor,
): Promise<boolean> {
  const row = await executor("users").where({ email }).whereNot({ id: exceptUserId }).first("id");
  return row !== undefined;
}

export async function insertUser(
  executor: DbExecutor,
  row: {
    id: string;
    email: string;
    role: UserRole;
    full_name: string;
    password_hash: string;
  },
): Promise<void> {
  await executor("users").insert({ ...row, is_verified: 1, is_active: 1 });
}

export interface AdminUserColumns {
  full_name?: string;
  email?: string;
  mobile?: string | null;
  role?: UserRole;
  is_active?: 0 | 1;
  head_of_department?: string | null;
  head_of_office?: string | null;
}

export async function updateUserColumns(
  executor: DbExecutor,
  id: string,
  columns: AdminUserColumns,
): Promise<void> {
  await executor("users").where({ id }).update(columns);
}

export async function countRequisitionsOwnedBy(
  executor: DbExecutor,
  userId: string,
): Promise<number> {
  const row = await executor("requisitions")
    .where({ requester_id: userId })
    .count({ n: "*" })
    .first();
  return Number(row?.n ?? 0);
}
