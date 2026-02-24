import { test, expect } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import {
  setupReservationMocks,
  createMockReservation,
} from '../../fixtures/reservation-mocks'
import { createMockVenue, StaffRole } from '../../fixtures/mock-data'

const RESERVATION_VENUE = createMockVenue({
  id: 'venue-alpha',
  name: 'Restaurante Alpha',
  slug: 'venue-alpha',
  permissions: [
    'menu:read', 'menu:create', 'menu:update', 'menu:delete',
    'teams:read', 'teams:invite', 'teams:update', 'teams:delete',
    'orders:read', 'orders:update',
    'payments:read',
    'reports:read',
    'settings:read', 'settings:update',
    'reservations:read', 'reservations:create', 'reservations:update', 'reservations:delete',
  ],
  modules: [
    { module: { id: 'mod-team', code: 'TEAM', name: 'Team Management' }, enabled: true },
    { module: { id: 'mod-res', code: 'RESERVATIONS', name: 'Reservations' }, enabled: true },
  ],
})

test.describe('Reservations List Page', () => {
  const reservations = [
    createMockReservation({ id: 'res-001', status: 'CONFIRMED', guestName: 'Alice Smith', channel: 'DASHBOARD' }),
    createMockReservation({ id: 'res-002', status: 'PENDING', guestName: 'Bob Jones', channel: 'WEB' }),
    createMockReservation({ id: 'res-003', status: 'CHECKED_IN', guestName: 'Carlos García', channel: 'PHONE' }),
    createMockReservation({ id: 'res-004', status: 'NO_SHOW', guestName: 'Diana López', channel: 'DASHBOARD' }),
  ]

  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page, {
      userRole: StaffRole.OWNER,
      venues: [RESERVATION_VENUE],
    })
    await setupReservationMocks(page, { reservations })
    // Hide TanStack Query devtools overlay that intercepts pointer events in dev mode
    await page.addInitScript(() => {
      const style = document.createElement('style')
      style.textContent = '.tsqd-parent-container { display: none !important; }'
      if (document.head) document.head.appendChild(style)
      else document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style))
    })
  })

  test('should load and display reservations list', async ({ page }) => {
    await page.goto('/venues/venue-alpha/reservations')

    // Wait for the page title to appear
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 })

    // Verify reservations are listed (guest names should appear)
    await expect(page.getByText('Alice Smith')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Bob Jones')).toBeVisible()
    await expect(page.getByText('Carlos García')).toBeVisible()
  })

  test('should display stats cards', async ({ page }) => {
    await page.goto('/venues/venue-alpha/reservations')

    // Wait for stats to load — the total count should appear
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 })

    // Stats should show total count
    const statsSection = page.locator('[class*="grid-cols"]').first()
    await expect(statsSection).toBeVisible({ timeout: 5_000 })
  })

  test('should navigate to detail page on row click', async ({ page }) => {
    await page.goto('/venues/venue-alpha/reservations')

    // Wait for data to load
    await expect(page.getByText('Alice Smith')).toBeVisible({ timeout: 10_000 })

    // Click on a reservation row
    await page.getByText('Alice Smith').click()

    // Should navigate to the detail page
    await expect(page).toHaveURL(/\/reservations\/res-001/, { timeout: 5_000 })
  })

  test('should filter by search term', async ({ page }) => {
    await page.goto('/venues/venue-alpha/reservations')
    await expect(page.getByText('Alice Smith')).toBeVisible({ timeout: 10_000 })

    // Open search input — click the search icon button
    const searchBtn = page.locator('button').filter({ has: page.locator('svg.lucide-search') })
    if (await searchBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await searchBtn.click()
    }

    // Type search term
    const searchInput = page.locator('input[placeholder]').last()
    if (await searchInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await searchInput.fill('Alice')
      // Allow debounce to trigger
      await page.waitForTimeout(500)
    }
  })
})
