import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./file.controller.js";

export const filesRouter = Router();

filesRouter.get(
  "/:id",
  authenticate(),
  validate({ params: z.strictObject({ id: z.uuid() }) }),
  controller.download,
);
