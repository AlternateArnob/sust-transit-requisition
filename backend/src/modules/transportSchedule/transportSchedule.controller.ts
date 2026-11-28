import type { Request, Response } from "express";
import { auditContext } from "../../services/audit.js";
import { lookup } from "./scheduleLookup.service.js";
import type { ScheduleLookupQuery } from "./transportSchedule.schemas.js";
import * as service from "./transportSchedule.service.js";

/** `authenticate` + `requireCapability(canManageSchedule)` ran first, so `req.user` is set. */
const context = (req: Request) => {
  const base = auditContext(req);
  return { ...base, actor: base.actor! };
};

const vehicleIdOf = (req: Request): string => String(req.params.vehicleId);

export async function list(_req: Request, res: Response): Promise<void> {
  res.json(await service.list());
}

/** 201 when the vehicle had no entry yet, 200 when an existing one was replaced (or already equal). */
export async function put(req: Request, res: Response): Promise<void> {
  const { entry, created } = await service.put(context(req), vehicleIdOf(req), req.body);
  res.status(created ? 201 : 200).json(entry);
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.remove(context(req), vehicleIdOf(req));
  res.status(204).end();
}

export async function scheduleLookup(req: Request, res: Response): Promise<void> {
  const { date } = req.query as unknown as ScheduleLookupQuery;
  res.json(await lookup(date));
}
