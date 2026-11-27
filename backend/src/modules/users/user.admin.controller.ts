import type { Request, Response } from "express";
import { auditContext } from "../../services/audit.js";
import type { ListUsersQuery } from "./user.admin.schemas.js";
import * as service from "./user.admin.service.js";

/** `authenticate` + `requireRole("SuperAdmin")` ran first, so `req.user` is set. */
const context = (req: Request) => {
  const base = auditContext(req);
  return { ...base, actor: base.actor! };
};

export async function list(req: Request, res: Response): Promise<void> {
  res.json(await service.list(req.query as unknown as ListUsersQuery));
}

export async function create(req: Request, res: Response): Promise<void> {
  res.status(201).json(await service.create(context(req), req.body));
}

export async function update(req: Request, res: Response): Promise<void> {
  res.json(await service.update(context(req), String(req.params.id), req.body));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.remove(context(req), String(req.params.id));
  res.status(204).end();
}
