import type { Request, Response } from "express";
import { checkHealth, getVersion } from "./health.service.js";

export async function health(_req: Request, res: Response): Promise<void> {
  const result = await checkHealth();
  res.status(result.db === "up" ? 200 : 503).json(result);
}

export function version(_req: Request, res: Response): void {
  res.json(getVersion());
}
