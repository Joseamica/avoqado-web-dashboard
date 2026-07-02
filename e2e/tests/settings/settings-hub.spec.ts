/**
 * E2E — Settings Hub (/venues/:slug/settings/*).
 *
 * Covers: index redirect by role, grouped nav rendering, section
 * navigation, and legacy-URL redirects (account, edit/*, activity-log).
 * Entry points (sidebar + avatar menu) are covered in Task 6's additions.
 * App E2E locale is English.
 */
import { test, expect, type Page } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { StaffRole, createMockVenue } from '../../fixtures/mock-data'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Close TanStack Query DevTools if open, then hide via CSS as fallback.
 * ReactQueryDevtools mounts with `initialIsOpen` in App.tsx, and its panel
 * covers the sidebar footer (where NavUser's avatar trigger lives) at the
 * bottom of the viewport. Mirrors the same helper in e2e/tests/auth/login.spec.ts.
 */
async function closeTanStackDevTools(page: Page) {
  const closeBtn = page.locator('button[aria-label="Close tanstack query devtools"]')
  if (await closeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await closeBtn.click()
    await page.waitForTimeout(300)
  }
  await page.evaluate(() => {
    document.querySelectorAll('.tsqd-parent-container').forEach(el => {
      ;(el as HTMLElement).style.display = 'none'
    })
  })
}

const SETTINGS_VENUE = createMockVenue({
  id: 'venue-alpha',
  name: 'Restaurante Alpha',
  slug: 'venue-alpha',
  permissions: [
    'home:read',
    'venues:read', 'venues:update',
    'settings:read', 'settings:update',
    'activity:read',
    'billing:read', 'billing:subscriptions:read',
  ],
})

test.describe('Settings hub', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [SETTINGS_VENUE] })
    // ProfileSettings (settings/profile) calls googleCalendarService.listConnections()
    // to render the "Personal Google Calendar" card. The shared catch-all mock
    // returns `{}` for unmocked /api/v1/** routes, which crashes the page because
    // the code does `gcalConnectionsData?.connections.find(...)` (only the outer
    // access is optional-chained). Mock the real shape here.
    await page.route('**/api/v1/google-calendar/connections', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ connections: [] }),
      }),
    )
    // Mark the cross-page platform welcome tour as already completed so it
    // doesn't auto-launch (useAutoLaunchPlatformWelcomeTour fires ~1.2s after
    // an OWNER/ADMIN lands on /home) and cover the sidebar/avatar-menu click
    // targets with its driver.js overlay.
    await page.route('**/api/v1/dashboard/venues/*/onboarding-state', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { 'platform-welcome-completed': true } }),
      }),
    )
  })

  test('settings index redirects admins to venue info and shows both groups', async ({ page }) => {
    await page.goto('/venues/venue-alpha/settings')
    await page.waitForURL('**/venues/venue-alpha/settings/local/basic-info', { timeout: 15_000 })
    // Scope to the desktop sidebar nav — the mobile horizontal strip renders the
    // same data-tour values but is CSS-hidden at this (desktop) viewport width.
    const nav = page.locator('[data-tour="settings-hub-nav"]')
    await expect(nav.locator('[data-tour="settings-nav-profile"]')).toBeVisible()
    await expect(nav.locator('[data-tour="settings-nav-venue-info"]')).toBeVisible()
    await expect(nav.locator('[data-tour="settings-nav-integrations"]')).toBeVisible()
    await expect(nav.locator('[data-tour="settings-nav-billing"]')).toBeVisible()
  })

  test('hub nav navigates between account and venue sections', async ({ page }) => {
    await page.goto('/venues/venue-alpha/settings')
    await page.waitForURL('**/settings/local/basic-info', { timeout: 15_000 })
    const nav = page.locator('[data-tour="settings-hub-nav"]')

    await nav.locator('[data-tour="settings-nav-profile"]').click()
    await page.waitForURL('**/settings/profile')
    await expect(page.locator('[data-tour="settings-profile-page"]')).toBeVisible()

    await nav.locator('[data-tour="settings-nav-preferences"]').click()
    await page.waitForURL('**/settings/preferences')
    await expect(page.locator('[data-tour="settings-preferences-page"]')).toBeVisible()

    await nav.locator('[data-tour="settings-nav-integrations"]').click()
    await page.waitForURL('**/settings/integrations')
    // Regression: VenueIntegrations used to call useVenueEditActions(), a hook
    // that throws outside <VenueEditLayout>. Since this page was promoted to a
    // standalone route (Task 4), that call crashed the page on every visit —
    // caught only by asserting real content renders, not just the URL.
    await expect(page.locator('[data-tour="settings-integrations-page"]')).toBeVisible()

    // Catalog layout: integration cards render, and a card CTA opens its
    // management surface in a FullScreenModal (ecommerce → "Online payments").
    await expect(page.locator('[data-tour="integration-card-google"]')).toBeVisible()
    await closeTanStackDevTools(page)
    await page.locator('[data-tour="integration-card-ecommerce"]').getByRole('button').click()
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Online payments' })).toBeVisible()
  })

  test('legacy URLs redirect to their new homes', async ({ page }) => {
    await page.goto('/venues/venue-alpha/account')
    await page.waitForURL('**/venues/venue-alpha/settings/profile', { timeout: 15_000 })

    await page.goto('/venues/venue-alpha/edit')
    await page.waitForURL('**/venues/venue-alpha/settings/local/basic-info')

    await page.goto('/venues/venue-alpha/edit/contact-images')
    await page.waitForURL('**/venues/venue-alpha/settings/local/contact-images')

    await page.goto('/venues/venue-alpha/edit/integrations')
    await page.waitForURL('**/venues/venue-alpha/settings/integrations')

    await page.goto('/venues/venue-alpha/activity-log')
    await page.waitForURL('**/venues/venue-alpha/settings/activity-log')
  })

  test('sidebar link and avatar menu both enter the hub', async ({ page }) => {
    await page.goto('/venues/venue-alpha/home')

    // Entry 1: sidebar "Settings" — single direct link straight to the hub.
    // The item has no sub-items after Task 6, so NavMain renders it as a
    // direct <NavLink> (role="link"), not a sub-sidebar trigger button.
    // Target by its stable data-tour key (tourKey('settings') = 'sidebar-settings')
    // rather than role+name, since role/name is ambiguous with other UI text.
    await page.locator('[data-tour="sidebar-settings"]').click()
    await page.waitForURL('**/settings/local/basic-info', { timeout: 15_000 })

    // Entry 2: avatar menu → Configuración → account side.
    // setupApiMocks (no `email` override) uses createMockUser's default email,
    // 'test@avoqado.io' — not 'owner@test.com' (that's login.spec's own fixture).
    await page.goto('/venues/venue-alpha/home')
    await closeTanStackDevTools(page)
    await page.getByText('test@avoqado.io').first().click()
    await page.locator('[data-tour="user-menu-settings"]').click()
    await page.waitForURL('**/settings/profile')
  })
})
