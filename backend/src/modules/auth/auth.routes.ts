import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requireCsrfHeader } from "../../middleware/csrf.js";
import { loginLimiter, otpLimiter, registerLimiter } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./auth.controller.js";
import { loginBody, registerBody, resendOtpBody, verifyOtpBody } from "./auth.schemas.js";

export const authRouter = Router();

authRouter.post(
  "/register",
  registerLimiter,
  validate({ body: registerBody }),
  controller.register,
);
authRouter.post("/otp/verify", otpLimiter, validate({ body: verifyOtpBody }), controller.verifyOtp);
authRouter.post("/otp/resend", otpLimiter, validate({ body: resendOtpBody }), controller.resendOtp);
authRouter.post("/login", loginLimiter, validate({ body: loginBody }), controller.login);

// Cookie-based, so they also require the X-Requested-With header (Part 1 §8.4).
authRouter.post("/refresh", requireCsrfHeader, controller.refresh);
authRouter.post("/logout", requireCsrfHeader, controller.logout);

// Onboarding tokens are accepted here so the client can learn its next step.
authRouter.get("/me", authenticate({ allowOnboarding: true }), controller.me);
