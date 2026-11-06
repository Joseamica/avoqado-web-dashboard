import { defineConfig, devices } from '@playwright/test'

// CI (ci-cd.yml, job test-and-build) serves the just-built bundle with
// `vite preview` on :4173 and sets E2E_BASE_URL. The bundle's VITE_API_URL does
// not matter there: every spec mocks `/api/v1/**` with page.route, and the one
// spec that needs a live backend (reservation-settings-redesign) skips itself in
// CI unless E2E_API_URL is provided. Locally, default to the dev server on :5173.
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const useExternalServer = !!process.env.E2E_BASE_URL

export default defineConfig({
  testDir: './e2e/tests',
  globalSetup: './e2e/global-warmup.ts',
  // La primera carga de cada worker contra el dev server tarda (Vite compila al pedir): 5 s es corto. Sigue fallando si la app no sale.
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Local: el dev server (Vite, un solo hilo) compila al pedir; con 5 workers a la vez la primera carga de cada uno se queda en blanco.
  workers: process.env.CI ? 1 : 2,
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
