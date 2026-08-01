import { playwright } from "vite-plus/test/browser-playwright";
import { defineConfig } from "vite-plus";
import { wavex } from "@wavex/vite-plugin";

export default defineConfig({
  plugins: [wavex()],
  test: {
    attachmentsDir: ".vitest-attachments",
    projects: [
      {
        test: {
          name: "convex",
          environment: "edge-runtime",
          include: ["convex/**/*.test.ts"],
        },
      },
      {
        plugins: [wavex()],
        test: {
          name: "browser",
          include: ["src/**/*.browser.test.ts"],
          browser: {
            enabled: true,
            headless: true,
            screenshotDirectory: ".vitest-browser/screenshots",
            screenshotFailures: true,
            trace: "retain-on-failure",
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
