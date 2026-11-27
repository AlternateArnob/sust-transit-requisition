import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { passwordChangeLimiter, uploadLimiter } from "../../middleware/rateLimit.js";
import { acceptSignature } from "../../middleware/upload.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./profile.controller.js";
import { changePasswordBody, updateProfileBody } from "./profile.schemas.js";

/** Own account, mounted at `/me` (Part 1 §12.3). */
export const meRouter = Router();

meRouter.get("/", authenticate(), controller.getMe);

// Onboarding tokens (issued after the email code) may finish the profile and upload the signature.
meRouter.put(
  "/profile",
  authenticate({ allowOnboarding: true }),
  validate({ body: updateProfileBody }),
  controller.updateProfile,
);
meRouter.post(
  "/signature",
  authenticate({ allowOnboarding: true }),
  uploadLimiter,
  acceptSignature(),
  controller.uploadSignature,
);

meRouter.put(
  "/password",
  authenticate(),
  passwordChangeLimiter,
  validate({ body: changePasswordBody }),
  controller.changePassword,
);
