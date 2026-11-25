import { defineConfig, devices } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "line",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    locale: "es-PE",
    timezoneId: "America/Lima",
  },
  projects: [
    {
      // Phone first: the narrowest target width of the demo.
      name: "phone-360",
      use: { ...devices["Pixel 7"], viewport: { width: 360, height: 740 } },
    },
    {
      name: "phone-390",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
      testMatch: /overflow\.spec\.ts/,
    },
  ],
  // Serves the static export in out/, so run `npm run build` first.
  webServer: {
    command: "node e2e/static-server.mjs",
    url: `http://localhost:${port}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
