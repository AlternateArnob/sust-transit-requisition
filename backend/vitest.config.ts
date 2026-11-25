import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    globalSetup: ["tests/globalSetup.ts"],
    // All database tests share one MySQL database (truncated between tests), so files run one at a time.
    fileParallelism: false,
    globals: false,
  },
});
