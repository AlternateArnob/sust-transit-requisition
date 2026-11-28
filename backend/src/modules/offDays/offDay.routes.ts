import { Router } from "express";
import { canManageOffDays } from "../../domain/permissions.js";
import { authenticate, requireCapability } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./offDay.controller.js";
import {
  createOffDayBody,
  listOffDaysQuery,
  offDayIdParams,
  updateOffDayBody,
} from "./offDay.schemas.js";

/** Vehicle off-days, mounted at `/off-days`. Transport In-Charge, Administrator, Super Admin. */
export const offDaysRouter = Router();

offDaysRouter.use(authenticate(), requireCapability(canManageOffDays));

offDaysRouter.get("/", validate({ query: listOffDaysQuery }), controller.list);
offDaysRouter.post("/", validate({ body: createOffDayBody }), controller.create);
offDaysRouter.patch(
  "/:id",
  validate({ params: offDayIdParams, body: updateOffDayBody }),
  controller.update,
);
offDaysRouter.delete("/:id", validate({ params: offDayIdParams }), controller.remove);
