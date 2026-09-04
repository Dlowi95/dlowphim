import { defineConfig, devices } from "@playwright/test";

const playwrightPort = Math.max(1, Number(process.env.PLAYWRIGHT_PORT) || 3000);
const localBaseUrl = `http://127.0.0.1:${playwrightPort}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: {
    // Next.js dev mode has to compile a route on its first visit. GitHub's
    // shared runners regularly need longer than Playwright's 5s default.
    timeout: process.env.CI ? 15_000 : 10_000,
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || localBaseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `npm run dev -- -p ${playwrightPort}`,
    url: localBaseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
