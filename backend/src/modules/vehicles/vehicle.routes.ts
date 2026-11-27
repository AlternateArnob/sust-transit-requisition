import { Router } from "express";
import { canManageVehicles } from "../../domain/permissions.js";
import { authenticate, requireCapability } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./vehicle.controller.js";
import {
  createVehicleBody,
  listVehiclesQuery,
  updateVehicleBody,
  vehicleIdParams,
} from "./vehicle.schemas.js";

/** Vehicle management, mounted at `/vehicles`. Transport In-Charge, Administrator, Super Admin. */
export const vehiclesRouter = Router();

vehiclesRouter.use(authenticate(), requireCapability(canManageVehicles));

const byId = validate({ params: vehicleIdParams });

vehiclesRouter.get("/", validate({ query: listVehiclesQuery }), controller.list);
vehiclesRouter.post("/", validate({ body: createVehicleBody }), controller.create);
vehiclesRouter.get("/:id", byId, controller.get);
vehiclesRouter.patch(
  "/:id",
  validate({ params: vehicleIdParams, body: updateVehicleBody }),
  controller.update,
);
vehiclesRouter.delete("/:id", byId, controller.remove);
