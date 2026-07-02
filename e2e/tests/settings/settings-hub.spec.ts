/**
 * E2E — Settings Hub (/venues/:slug/settings/*).
 *
 * Covers: index redirect by role, grouped nav rendering, section
 * navigation, and legacy-URL redirects (account, edit/*, activity-log).
 * Entry points (sidebar + avatar menu) are covered in Task 6's additions.
 * App E2E locale is English.
 */
import { test, expect } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { StaffRole, createMockVenue } from '../../fixtures/mock-data'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

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
})
