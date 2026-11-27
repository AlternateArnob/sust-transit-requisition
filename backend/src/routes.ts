import { Router } from "express";
import { authRouter } from "./modules/auth/auth.routes.js";
import { directoryRouter } from "./modules/directory/directory.routes.js";
import { driversRouter } from "./modules/drivers/driver.routes.js";
import { filesRouter } from "./modules/files/file.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { meRouter } from "./modules/users/profile.routes.js";
import { usersRouter } from "./modules/users/user.admin.routes.js";

/** Mounted at env.API_BASE_PATH by app.ts. Later steps register their module routers here. */
export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/directory", directoryRouter);
apiRouter.use("/me", meRouter);
apiRouter.use("/files", filesRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/drivers", driversRouter);
