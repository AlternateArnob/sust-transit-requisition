// Environment for the whole test run. Tests must never touch the development database, so the
// database name is forced; everything else only fills gaps (CI sets these itself).
process.env.NODE_ENV = "test";
process.env.DB_NAME = "sust_transit_test";
process.env.DB_HOST ??= "127.0.0.1";
process.env.DB_PORT ??= "3306";
process.env.DB_USER ??= "sust_transit";
process.env.DB_PASSWORD ??= "change-me";
process.env.JWT_ACCESS_SECRET ??= "test-secret-that-is-at-least-32-characters-long";
process.env.CLIENT_ORIGIN ??= "http://localhost:5173";
