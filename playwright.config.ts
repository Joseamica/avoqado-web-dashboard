import { defineConfig, devices } from '@playwright/test'

// CI (ci-cd.yml, job test-and-build) serves the just-built bundle with
// `vite preview` on :4173 and sets E2E_BASE_URL. The bundle's VITE_API_URL does
// not matter there: every spec mocks `/api/v1/**` with page.route, and the one
// spec that needs a live backend (reservation-settings-redesign) skips itself in
// CI unless E2E_API_URL is provided. Locally, default to :5173; isolated labs set
// E2E_PORT so Playwright owns a strict, non-reused server instead of attaching
// to a different session's dashboard.
const localPort = process.env.E2E_PORT ?? '5173'
const localURL = `http://127.0.0.1:${localPort}`
const baseURL = process.env.E2E_BASE_URL ?? localURL
const useExternalServer = !!process.env.E2E_BASE_URL
const useIsolatedServer = !!process.env.E2E_PORT
const useInstalledChrome = process.env.PLAYWRIGHT_USE_INSTALLED_CHROME === '1'

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
      use: { ...devices['Desktop Chrome'], ...(useInstalledChrome ? { channel: 'chrome' as const } : {}) },
    },
  ],

  // Local: Playwright manages the dev server. CI: a preview server is
  // started explicitly in the workflow before invoking playwright, so we
  // skip the managed webServer and rely on the URL being reachable.
  webServer: useExternalServer
    ? undefined
    : {
        command: `npm run dev -- --host 127.0.0.1 --port ${localPort} --strictPort`,
        url: localURL,
        reuseExistingServer: !useIsolatedServer,
      },
})
