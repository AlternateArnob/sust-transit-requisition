import { Router } from "express";
import { canManageDrivers } from "../../domain/permissions.js";
import { authenticate, requireCapability } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./driver.controller.js";
import {
  createDriverBody,
  driverIdParams,
  listDriversQuery,
  updateDriverBody,
} from "./driver.schemas.js";

/** Driver management, mounted at `/drivers`. Transport In-Charge, Administrator and Super Admin only. */
export const driversRouter = Router();

driversRouter.use(authenticate(), requireCapability(canManageDrivers));

const byId = validate({ params: driverIdParams });

driversRouter.get("/", validate({ query: listDriversQuery }), controller.list);
driversRouter.post("/", validate({ body: createDriverBody }), controller.create);
driversRouter.patch(
  "/:id",
  validate({ params: driverIdParams, body: updateDriverBody }),
  controller.update,
);
driversRouter.post("/:id/deactivate", byId, controller.deactivate);
driversRouter.post("/:id/activate", byId, controller.activate);
driversRouter.delete("/:id", byId, controller.remove);
