import { expect, test, type Page } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { createMockVenue, StaffRole } from '../../fixtures/mock-data'

const exchange = {
  id: 'exchange-review-1',
  status: 'NEEDS_REVIEW',
  createdAt: '2026-10-26T18:00:00Z',
  originalOrderId: 'c1234567890123456789012345',
  newOrderId: 'c2345678901234567890123456',
  originalPaymentId: 'payment-original',
  chargePaymentId: 'payment-charge',
  originalOrderNumber: 'ORD-IQ-001',
  newOrderNumber: 'ORD-IQ-002',
  differenceCents: 5050,
  reviewReason: 'CHARGE_AMOUNT_MISMATCH',
  staffName: 'Ana López',
  reviewedAt: null,
}

async function setup(page: Page, canReview = true) {
  await page.addInitScript(() => {
    localStorage.setItem('lang', 'es')
  })
  await setupApiMocks(page, {
    userRole: StaffRole.MANAGER,
    venues: [
      createMockVenue({
        id: 'venue-alpha',
        slug: 'venue-alpha',
        permissions: ['payments:read', ...(canReview ? ['payments:refund'] : [])],
      }),
    ],
  })
}

test('review writes a note and removes the row without reloading', async ({ page }) => {
  await setup(page)
  let reviewed = false
  let note: unknown
  await page.route('**/api/v1/dashboard/venues/venue-alpha/exchanges*', route =>
    route.fulfill({
      json: {
        success: true,
        data: { items: reviewed ? [] : [exchange], total: reviewed ? 0 : 1, nextCursor: null },
      },
    }),
  )
  await page.route('**/exchanges/exchange-review-1/review', route => {
    note = route.request().postDataJSON()
    reviewed = true
    return route.fulfill({ json: { success: true, data: { ...exchange, reviewedAt: '2026-10-26T19:00:00Z' } } })
  })
  await page.goto('/venues/venue-alpha/payments/exchanges')
  await expect(page.getByText('ORD-IQ-001 → ORD-IQ-002')).toBeVisible()
  await page.getByRole('button', { name: 'Marcar revisado', exact: true }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog.getByRole('button', { name: 'Marcar revisado' })).toBeDisabled()
  await dialog.getByRole('textbox', { name: 'Nota de revisión' }).fill('Revisado con Ana')
  await dialog.getByRole('button', { name: 'Marcar revisado' }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByText('No hay cambios por revisar')).toBeVisible()
  await expect(page.getByText('ORD-IQ-001 → ORD-IQ-002')).toHaveCount(0)
  expect(note).toEqual({ note: 'Revisado con Ana' })
})

test('read access without refund or report permissions shows the row without a review action', async ({ page }) => {
  await setup(page, false)
  await page.route('**/api/v1/dashboard/venues/venue-alpha/exchanges*', route =>
    route.fulfill({
      json: {
        success: true,
        data: { items: [exchange], total: 1, nextCursor: null },
      },
    }),
  )
  await page.goto('/venues/venue-alpha/payments/exchanges')
  await expect(page.getByText('ORD-IQ-001 → ORD-IQ-002')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Marcar revisado' })).toHaveCount(0)
})

test('an exchange list failure is retryable and distinct from empty', async ({ page }) => {
  await setup(page)
  let failed = true
  await page.route('**/api/v1/dashboard/venues/venue-alpha/exchanges*', route =>
    failed
      ? route.fulfill({ status: 503, json: { message: 'Unavailable' } })
      : route.fulfill({ json: { success: true, data: { items: [], total: 0, nextCursor: null } } }),
  )
  await page.goto('/venues/venue-alpha/payments/exchanges')
  await expect(page.getByText('No se pudieron cargar los cambios.')).toBeVisible()
  await expect(page.getByText('No hay cambios por revisar')).toHaveCount(0)
  failed = false
  await page.getByRole('button', { name: 'Reintentar' }).click()
  await expect(page.getByText('No hay cambios por revisar')).toBeVisible()
})
