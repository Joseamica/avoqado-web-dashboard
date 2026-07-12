/**
 * Regression test: menu hours on the Menus list page.
 *
 * Bug: availableFrom/availableUntil are plain "HH:mm" venue-local strings,
 * but the list rendered them through formatDateInTimeZone(), which parsed
 * "10:00" as a UTC instant and shifted it to America/Mexico_City (-6h),
 * showing "4:00 AM - 1:00 PM" instead of "10:00 - 19:00".
 *
 * Navigation path: /venues/venue-alpha/menumaker/menus
 */

import { test, expect, Page } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { StaffRole, createMockVenue } from '../../fixtures/mock-data'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

const VENUE = createMockVenue({
  id: 'venue-alpha',
  name: 'Venue Alpha',
  slug: 'venue-alpha',
  permissions: ['menu:read', 'menu:create', 'menu:update', 'menu:delete', 'teams:read', 'settings:read', 'reports:read'],
})

const MOCK_MENUS = [
  {
    id: 'menu-001',
    venueId: 'venue-alpha',
    name: 'Menu 1',
    description: null,
    type: 'REGULAR',
    active: true,
    isFixed: false,
    displayOrder: 0,
    availableFrom: '10:00',
    availableUntil: '19:00',
    availableDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    startDate: null,
    endDate: null,
    categories: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'menu-002',
    venueId: 'venue-alpha',
    name: 'Menu Todo el Dia',
    description: null,
    type: 'REGULAR',
    active: true,
    isFixed: false,
    displayOrder: 1,
    availableFrom: null,
    availableUntil: null,
    availableDays: [],
    startDate: null,
    endDate: null,
    categories: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

async function setupMenusMock(page: Page): Promise<void> {
  await page.route(
    url => url.pathname.includes('/api/') && /\/venues\/[^/]+\/menus$/.test(url.pathname),
    route => {
      if (route.request().method() !== 'GET') return route.fallback()
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_MENUS),
      })
    },
  )
}

test.describe('Menus list — schedule column', () => {
  test('shows availableFrom/availableUntil as plain HH:mm, without timezone shift', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE] })
    await setupMenusMock(page)

    await page.goto('/venues/venue-alpha/menumaker/menus')

    const row = page.getByRole('row', { name: /Menu 1/ })
    await expect(row).toBeVisible({ timeout: 15_000 })

    // The stored "10:00"–"19:00" must render verbatim...
    await expect(row).toContainText('10:00 - 19:00')

    // ...and NOT the UTC→Mexico_City (-6h) shifted version the bug produced.
    await expect(row).not.toContainText('4:00 AM')
    await expect(row).not.toContainText('1:00 PM')
  })

  test('menu without hours shows the always-available label', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE] })
    await setupMenusMock(page)

    await page.goto('/venues/venue-alpha/menumaker/menus')

    const row = page.getByRole('row', { name: /Menu Todo el Dia/ })
    await expect(row).toBeVisible({ timeout: 15_000 })
    await expect(row).toContainText(/Siempre disponible|Always available/i)
  })
})
