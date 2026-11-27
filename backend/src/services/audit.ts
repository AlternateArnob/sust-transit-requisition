import type { Request } from "express";
import type { UserRole } from "../config/constants.js";
import { db } from "../db/knex.js";
import type { DbExecutor } from "../db/transaction.js";

// Part 1 §19.2. Audit rows are written through the same executor as the change they describe, so
// they commit or roll back together with it.

export interface AuditActor {
  id: string;
  role: UserRole;
}

export interface AuditEntry {
  /** Null for events with no logged-in user (a failed login, a system job). */
  actor?: AuditActor | null;
  /** `entity.verb`, e.g. `user.role_changed`. */
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  requestId?: string | null;
}

const toJson = (value: unknown): string | null =>
  value === undefined || value === null ? null : JSON.stringify(value);

export async function logAudit(executor: DbExecutor, entry: AuditEntry): Promise<void> {
  await executor("audit_logs").insert({
    actor_user_id: entry.actor?.id ?? null,
    actor_role: entry.actor?.role ?? null,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    before_json: toJson(entry.before),
    after_json: toJson(entry.after),
    ip: entry.ip ?? null,
    request_id: entry.requestId ?? null,
  });
}

/** `audit.log(trx, {...})` as the plan names it. */
export const audit = { log: logAudit };

/** The who/where of a request, to spread into an `AuditEntry`. */
export function auditContext(req: Request): Pick<AuditEntry, "actor" | "ip" | "requestId"> {
  return {
    actor: req.user ? { id: req.user.id, role: req.user.role } : null,
    ip: req.ip ?? null,
    requestId: req.id === undefined ? null : String(req.id),
  };
}

/** Standalone use outside a transaction (rare). */
export const logAuditNow = (entry: AuditEntry): Promise<void> => logAudit(db, entry);
