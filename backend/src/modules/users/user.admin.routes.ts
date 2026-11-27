import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./user.admin.controller.js";
import {
  createUserBody,
  listUsersQuery,
  updateUserBody,
  userIdParams,
} from "./user.admin.schemas.js";

/** Account management, mounted at `/users`. Super Admin only (Part 1 §12.4). */
export const usersRouter = Router();

usersRouter.use(authenticate(), requireRole("SuperAdmin"));

usersRouter.get("/", validate({ query: listUsersQuery }), controller.list);
usersRouter.post("/", validate({ body: createUserBody }), controller.create);
usersRouter.patch(
  "/:id",
  validate({ params: userIdParams, body: updateUserBody }),
  controller.update,
);
usersRouter.delete("/:id", validate({ params: userIdParams }), controller.remove);
