import { defineConfig, devices } from "@playwright/test";

const basePath = process.env.YAGOO_DORI_BASE_PATH ?? "/yagoo-dori";
const port = Number(process.env.PORT ?? 3100);
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./apps/web/pages-e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: origin,
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm preview:pages",
    env: {
      HOST: "127.0.0.1",
      PORT: String(port),
      YAGOO_DORI_BASE_PATH: basePath,
    },
    reuseExistingServer: false,
    timeout: 30_000,
    url: `${origin}${basePath}/`,
  },
});
