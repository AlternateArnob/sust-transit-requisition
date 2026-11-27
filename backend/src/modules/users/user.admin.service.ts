import { v4 as uuid } from "uuid";
import type { UserRole } from "../../config/constants.js";
import { withTransaction } from "../../db/transaction.js";
import { buildAccountStatusMessage } from "../../domain/accountStatus.js";
import {
  conflict,
  forbidden,
  notFound,
  validation,
  type ErrorDetail,
} from "../../errors/AppError.js";
import { audit, type AuditEntry } from "../../services/audit.js";
import { deleteStoredFile } from "../../services/fileStorage.js";
import { notifyUser } from "../../services/notify.js";
import { assertPasswordPolicy, hashPassword } from "../../services/password.js";
import { revokeAllForUser } from "../../services/tokens.js";
import { toPage, type Page } from "../../http/pagination.js";
import { resolveUnitName } from "../directory/directory.service.js";
import {
  countRequisitionsOwnedBy,
  emailBelongsToOtherUser,
  insertUser,
  listUsers,
  lockActiveSuperAdmins,
  updateUserColumns,
  type AdminUserColumns,
} from "./user.admin.repository.js";
import type { CreateUserBody, ListUsersQuery, UpdateUserBody } from "./user.admin.schemas.js";
import { toPublicUser, type PublicUser } from "./user.mapper.js";
import { findUserByEmail, findUserById, type UserRecord } from "./user.repository.js";

// Super Admin account management (Part 1 §12.4). Every write runs in one transaction that also
// holds the audit row, the notification and the token revocation it implies.

type RequestContext = Pick<AuditEntry, "actor" | "ip" | "requestId"> & {
  actor: NonNullable<AuditEntry["actor"]>;
};

const emailTaken = () =>
  conflict("EMAIL_TAKEN", "Another account already uses this email address.");

const isDuplicateKey = (error: unknown): boolean =>
  (error as { code?: string } | null)?.code === "ER_DUP_ENTRY";

/** The fields an audit row records for a user. Never the password hash. */
function snapshot(user: UserRecord) {
  return {
    fullName: user.fullName,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    isActive: user.isActive,
    headOfDepartment: user.headOfDepartment,
    headOfOffice: user.headOfOffice,
  };
}

export async function list(query: ListUsersQuery): Promise<Page<PublicUser>> {
  const { rows, total } = await listUsers({
    role: query.role,
    isActive: query.isActive,
    q: query.q,
    sort: query.sort.sort,
    direction: query.sort.direction,
    page: query.page,
    pageSize: query.pageSize,
  });
  return toPage(rows.map(toPublicUser), query.page, query.pageSize, total);
}

/** Appoints a Transport Office or Super Admin account: verified and active, no OTP (§12.4). */
export async function create(ctx: RequestContext, body: CreateUserBody): Promise<PublicUser> {
  assertPasswordPolicy(body.password);
  const passwordHash = await hashPassword(body.password); // slow, so outside the transaction

  return withTransaction(async (trx) => {
    if (await findUserByEmail(body.email, trx)) throw emailTaken();

    const id = uuid();
    try {
      await insertUser(trx, {
        id,
        email: body.email,
        role: body.role,
        full_name: body.fullName,
        password_hash: passwordHash,
      });
    } catch (error) {
      if (isDuplicateKey(error)) throw emailTaken();
      throw error;
    }

    const created = (await findUserById(id, trx))!;
    await audit.log(trx, {
      ...ctx,
      action: "user.created",
      entityType: "user",
      entityId: id,
      after: snapshot(created),
    });
    return toPublicUser(created);
  });
}

/** `undefined` keeps the stored scope; `null` or blank clears it; otherwise it must be in the directory. */
async function resolveScope(
  kind: "Department" | "Office",
  provided: string | null | undefined,
  stored: string | null,
  path: string,
  errors: ErrorDetail[],
  executor: Parameters<typeof resolveUnitName>[2],
): Promise<string | null> {
  if (provided === undefined) return stored;
  if (provided === null || provided === "") return null;
  const name = await resolveUnitName(kind, provided, executor);
  if (!name) errors.push({ path, message: `Unknown ${kind.toLowerCase()}: ${provided}` });
  return name;
}

const isDeadlock = (error: unknown): boolean =>
  (error as { code?: string } | null)?.code === "ER_LOCK_DEADLOCK";

/**
 * Two admins editing at once can still make InnoDB pick a deadlock victim (it rolls the victim
 * back). Running the whole edit again is safe and sees the winner's committed state.
 */
export async function update(
  ctx: RequestContext,
  targetId: string,
  body: UpdateUserBody,
): Promise<PublicUser> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await updateOnce(ctx, targetId, body);
    } catch (error) {
      if (!isDeadlock(error) || attempt >= 3) throw error;
    }
  }
}

async function updateOnce(
  ctx: RequestContext,
  targetId: string,
  body: UpdateUserBody,
): Promise<PublicUser> {
  return withTransaction(async (trx) => {
    // Lock order is always "active Super Admins, then the target", so concurrent edits queue up.
    const activeSuperAdminIds = await lockActiveSuperAdmins(trx);
    const target = await findUserById(targetId, trx, { forUpdate: true });
    if (!target) throw notFound("User not found");

    const nextRole: UserRole = body.role ?? target.role;
    const nextActive = body.isActive ?? target.isActive;
    const roleChanged = nextRole !== target.role;
    const activeChanged = nextActive !== target.isActive;

    if (target.id === ctx.actor.id && (roleChanged || activeChanged)) {
      throw forbidden("You can't change your own role or active status here.");
    }

    const removesSuperAdmin =
      target.role === "SuperAdmin" && target.isActive && (nextRole !== "SuperAdmin" || !nextActive);
    if (removesSuperAdmin && activeSuperAdminIds.length <= 1) {
      throw conflict(
        "LAST_SUPER_ADMIN",
        "This is the only active Super Admin account. Make another account an active Super Admin first.",
      );
    }

    if (body.email !== undefined && body.email !== target.email) {
      if (await emailBelongsToOtherUser(body.email, target.id, trx)) throw emailTaken();
    }

    // Head scope only exists for Department Heads; leaving the role clears it.
    const errors: ErrorDetail[] = [];
    let headOfDepartment: string | null = null;
    let headOfOffice: string | null = null;
    if (nextRole === "DepartmentHead") {
      headOfDepartment = await resolveScope(
        "Department",
        body.headOfDepartment,
        target.headOfDepartment,
        "headOfDepartment",
        errors,
        trx,
      );
      headOfOffice = await resolveScope(
        "Office",
        body.headOfOffice,
        target.headOfOffice,
        "headOfOffice",
        errors,
        trx,
      );
      if (errors.length === 0 && !headOfDepartment && !headOfOffice) {
        errors.push({
          path: "headOfDepartment",
          message: "Select the department or office this Department Head is responsible for.",
        });
      }
    }
    if (errors.length > 0) throw validation(errors);

    const columns: AdminUserColumns = {};
    if (body.fullName !== undefined && body.fullName !== target.fullName)
      columns.full_name = body.fullName;
    if (body.email !== undefined && body.email !== target.email) columns.email = body.email;
    if (body.mobile !== undefined && body.mobile !== target.mobile) columns.mobile = body.mobile;
    if (roleChanged) columns.role = nextRole;
    if (activeChanged) columns.is_active = nextActive ? 1 : 0;
    if (headOfDepartment !== target.headOfDepartment) columns.head_of_department = headOfDepartment;
    if (headOfOffice !== target.headOfOffice) columns.head_of_office = headOfOffice;

    if (Object.keys(columns).length === 0) return toPublicUser(target);

    await updateUserColumns(trx, target.id, columns);
    const updated = (await findUserById(target.id, trx))!;
    const before = snapshot(target);
    const after = snapshot(updated);

    if (target.isActive && !updated.isActive) await revokeAllForUser(target.id, { trx });

    const message = buildAccountStatusMessage({
      activeChanged,
      isActive: updated.isActive,
      roleChanged,
      role: updated.role,
    });
    if (message) {
      await notifyUser(trx, {
        recipientUserId: target.id,
        type: "Account Status Changed",
        message,
        linkType: "user",
        linkId: target.id,
      });
    }

    const audited = (action: string) =>
      audit.log(trx, { ...ctx, action, entityType: "user", entityId: target.id, before, after });
    if (roleChanged) await audited("user.role_changed");
    if (activeChanged) await audited(updated.isActive ? "user.reactivated" : "user.deactivated");
    const profileKeys = [
      "fullName",
      "email",
      "mobile",
      "headOfDepartment",
      "headOfOffice",
    ] as const;
    if (profileKeys.some((key) => before[key] !== after[key])) await audited("user.updated");

    return toPublicUser(updated);
  });
}

/** Only other Super Admin accounts can be deleted, and never one that owns requisitions (§12.4). */
export async function remove(ctx: RequestContext, targetId: string): Promise<void> {
  const diskFiles = await withTransaction(async (trx) => {
    const target = await findUserById(targetId, trx, { forUpdate: true });
    if (!target) throw notFound("User not found");
    if (target.id === ctx.actor.id) throw forbidden("You can't delete your own account.");
    if (target.role !== "SuperAdmin") throw forbidden("Only Super Admin accounts can be deleted.");

    if ((await countRequisitionsOwnedBy(trx, target.id)) > 0) {
      throw conflict("USER_HAS_HISTORY", "This account owns requisitions and cannot be deleted.");
    }

    const files = await trx("files")
      .where({ owner_user_id: target.id })
      .select("id", "storage_name");
    try {
      await trx("users").where({ id: target.id }).delete();
    } catch (error) {
      // Some other table still points at this account (an approval, a recommendation, ...).
      if ((error as { code?: string }).code === "ER_ROW_IS_REFERENCED_2") {
        throw conflict("USER_HAS_HISTORY", "This account is referenced by existing records.");
      }
      throw error;
    }
    await trx("files").where({ owner_user_id: target.id }).delete();
    await trx("otp_challenges").where({ email: target.email }).delete();

    await audit.log(trx, {
      ...ctx,
      action: "user.deleted",
      entityType: "user",
      entityId: target.id,
      before: snapshot(target),
    });
    return files.map((file) => file.storage_name as string);
  });

  // Disk files go only after the commit, so a rollback never leaves rows pointing at nothing.
  await Promise.all(diskFiles.map((name) => deleteStoredFile(name)));
}
