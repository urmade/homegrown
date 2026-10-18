import { defineConfig } from "vitest/config";

export default defineConfig({
  root: new URL("../..", import.meta.url).pathname,
  test: {
    include: ["core/tests/**/*.test.ts", "packages/*/tests/**/*.test.ts", "apps/*/tests/**/*.test.ts", "tools/harness/tests/**/*.test.ts"],
    globalSetup: ["tools/harness/vitest.setup.ts"],
    environment: "node",
    fileParallelism: false,
    // One retry; a test that only passes on retry is reported as flaky (quarantine signature).
    retry: 1,
    reporters: ["default", ["json", { outputFile: "artifacts/vitest.json" }]],
    // Test-only credentials for the agent VM's native Postgres; CI overrides them.
    env: {
      NODE_ENV: "test",
      HG_LOG_SINKS: "stdout",
      HG_LOG_LEVEL: "warn",
      MIGRATE_DATABASE_URL: process.env.MIGRATE_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/homegrown_test",
      DATABASE_URL: process.env.DATABASE_URL ?? "postgres://homegrown_app:app@localhost:5432/homegrown_test",
      APP_DB_PASSWORD: process.env.APP_DB_PASSWORD ?? "app",
    },
  },
});
