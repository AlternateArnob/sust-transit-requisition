import { Router } from "express";
import { canManageSchedule } from "../../domain/permissions.js";
import { authenticate, requireCapability } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  putTransportScheduleBody,
  scheduleLookupQuery,
  transportScheduleParams,
} from "./transportSchedule.schemas.js";
import * as controller from "./transportSchedule.controller.js";

/** Student-transport schedule, mounted at `/transport-schedule`. In-Charge, Administrator, Super Admin. */
export const transportScheduleRouter = Router();

transportScheduleRouter.use(authenticate(), requireCapability(canManageSchedule));

transportScheduleRouter.get("/", controller.list);
transportScheduleRouter.put(
  "/:vehicleId",
  validate({ params: transportScheduleParams, body: putTransportScheduleBody }),
  controller.put,
);
transportScheduleRouter.delete(
  "/:vehicleId",
  validate({ params: transportScheduleParams }),
  controller.remove,
);

/** `GET /schedule/lookup?date=YYYY-MM-DD`, mounted at `/schedule`; same roles. */
export const scheduleLookupRouter = Router();

scheduleLookupRouter.use(authenticate(), requireCapability(canManageSchedule));

scheduleLookupRouter.get(
  "/lookup",
  validate({ query: scheduleLookupQuery }),
  controller.scheduleLookup,
);
