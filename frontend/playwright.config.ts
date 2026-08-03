import { defineConfig } from "@playwright/test";

const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173",
    launchOptions: chromiumExecutablePath
      ? {
          executablePath: chromiumExecutablePath,
        }
      : undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Playwright's bundled ffmpeg is not present when CI intentionally uses a
    // system Chromium executable. Traces and screenshots still preserve
    // failure evidence for that runner.
    video: chromiumExecutablePath ? "off" : "retain-on-failure",
  },
});
