import { defineConfig, devices } from '@playwright/test'

// CI runs `vite preview` against the just-built bundle on port 4173 with
// VITE_API_URL pointing at the deployed demo backend, so the spec exercises
// real network paths. Locally, default to the dev server on :5173.
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const useExternalServer = !!process.env.E2E_BASE_URL

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Local: Playwright manages the dev server. CI: a preview server is
  // started explicitly in the workflow before invoking playwright, so we
  // skip the managed webServer and rely on the URL being reachable.
  webServer: useExternalServer
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
      },
})
