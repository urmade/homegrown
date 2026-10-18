import { defineConfig, devices } from "@playwright/test";

const root = new URL("../..", import.meta.url).pathname;

export default defineConfig({
  testDir: root,
  testMatch: ["tools/harness/e2e/**/*.spec.ts", "apps/*/e2e/**/*.spec.ts"],
  outputDir: `${root}test-results`,
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [["list"], ["html", { outputFolder: `${root}playwright-report`, open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    ...devices["Desktop Chrome"],
    serviceWorkers: "allow",
    launchOptions: process.env.PW_CHROME_PATH ? { executablePath: process.env.PW_CHROME_PATH } : {},
  },
  webServer: {
    command: "pnpm start",
    cwd: root,
    url: "http://127.0.0.1:3000/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
