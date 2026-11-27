import type { Request, Response } from "express";
import { auditContext } from "../../services/audit.js";
import type { ListDriversQuery } from "./driver.schemas.js";
import * as service from "./driver.service.js";

/** `authenticate` + `requireCapability(canManageDrivers)` ran first, so `req.user` is set. */
const context = (req: Request) => {
  const base = auditContext(req);
  return { ...base, actor: base.actor! };
};

const idOf = (req: Request): string => String(req.params.id);

export async function list(req: Request, res: Response): Promise<void> {
  res.json(await service.list(req.query as unknown as ListDriversQuery));
}

export async function create(req: Request, res: Response): Promise<void> {
  res.status(201).json(await service.create(context(req), req.body));
}

export async function update(req: Request, res: Response): Promise<void> {
  res.json(await service.update(context(req), idOf(req), req.body));
}

export async function deactivate(req: Request, res: Response): Promise<void> {
  res.json(await service.deactivate(context(req), idOf(req)));
}

export async function activate(req: Request, res: Response): Promise<void> {
  res.json(await service.activate(context(req), idOf(req)));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.remove(context(req), idOf(req));
  res.status(204).end();
}
