import { Router } from "express";
import * as controller from "./directory.controller.js";

/** Part 1 §12.2. Public: the registration and profile screens need the lists before login. */
export const directoryRouter = Router();

directoryRouter.get("/departments", controller.departments);
directoryRouter.get("/offices", controller.offices);
