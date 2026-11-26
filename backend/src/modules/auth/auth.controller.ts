import type { Request, Response } from "express";
import { AppError } from "../../errors/AppError.js";
import {
  clearRefreshCookie,
  readRefreshCookie,
  requestMeta,
  setRefreshCookie,
} from "../../services/tokens.js";
import { toMeResponse } from "../users/user.mapper.js";
import type { LoginBody, RegisterBody, ResendOtpBody, VerifyOtpBody } from "./auth.schemas.js";
import * as authService from "./auth.service.js";

// Controllers only translate HTTP to service calls and back (Part 1 §5 layering rule).

export async function register(req: Request, res: Response): Promise<void> {
  const { email } = req.body as RegisterBody;
  res.status(202).json(await authService.register(email));
}

export async function verifyOtp(req: Request, res: Response): Promise<void> {
  const { email, code } = req.body as VerifyOtpBody;
  res.json(await authService.verifyEmail(email, code));
}

export async function resendOtp(req: Request, res: Response): Promise<void> {
  const { email } = req.body as ResendOtpBody;
  res.status(202).json(await authService.resendOtp(email));
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as LoginBody;
  const result = await authService.login(email, password, requestMeta(req));

  if (result.kind === "otp-required") {
    res.json({ nextStep: result.nextStep, ...result.dispatch });
    return;
  }

  const { session } = result;
  setRefreshCookie(res, session.refresh.token, session.refresh.expiresAt);
  res.json({
    accessToken: session.accessToken,
    expiresIn: session.expiresIn,
    user: session.user,
  });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const token = readRefreshCookie(req);
  if (!token) throw new AppError(401, "UNAUTHENTICATED", "Session expired. Please log in again.");

  try {
    const session = await authService.refreshSession(token, requestMeta(req));
    setRefreshCookie(res, session.refresh.token, session.refresh.expiresAt);
    res.json({
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
      user: session.user,
    });
  } catch (error) {
    // A cookie that no longer works is removed so the browser stops sending it.
    clearRefreshCookie(res);
    throw error;
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  await authService.logout(readRefreshCookie(req));
  clearRefreshCookie(res);
  res.status(204).end();
}

export function me(req: Request, res: Response): void {
  // `authenticate` has just loaded this row from the database.
  res.json(toMeResponse(req.user!.record));
}
