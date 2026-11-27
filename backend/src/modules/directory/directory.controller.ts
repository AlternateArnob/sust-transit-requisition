import type { Request, Response } from "express";
import * as directoryService from "./directory.service.js";

export async function departments(_req: Request, res: Response): Promise<void> {
  res.json({ data: await directoryService.listDepartments() });
}

export async function offices(_req: Request, res: Response): Promise<void> {
  res.json({ data: await directoryService.listOffices() });
}
