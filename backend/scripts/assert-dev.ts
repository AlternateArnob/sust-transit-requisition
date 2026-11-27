// Safety guard for destructive scripts (db:reset). Refuses to run in production.
import "dotenv/config";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run: db:reset is for development only (NODE_ENV=production).");
  process.exit(1);
}
