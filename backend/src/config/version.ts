import { createRequire } from "node:module";

// Resolves to backend/package.json from both src/config (dev) and dist/config (build).
const require = createRequire(import.meta.url);
const pkg = require("../../package.json") as { name: string; version: string };

export const APP_NAME: string = pkg.name;
export const APP_VERSION: string = pkg.version;
