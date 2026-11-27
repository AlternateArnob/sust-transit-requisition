import { tmpdir } from "node:os";
import { join } from "node:path";
// Environment for the whole test run. Tests must never touch the development database, so the
// database name is forced; everything else only fills gaps (CI sets these itself).
process.env.NODE_ENV = "test";
process.env.DB_NAME = "sust_transit_test";
// Uploaded files go to a throw-away directory, never to the development ./uploads.
process.env.UPLOAD_DIR = join(tmpdir(), "sust-transit-test-uploads");
process.env.DB_HOST ??= "127.0.0.1";
process.env.DB_PORT ??= "3306";
process.env.DB_USER ??= "sust_transit";
process.env.DB_PASSWORD ??= "change-me";
process.env.JWT_ACCESS_SECRET ??= "test-secret-that-is-at-least-32-characters-long";
process.env.CLIENT_ORIGIN ??= "http://localhost:5173";
