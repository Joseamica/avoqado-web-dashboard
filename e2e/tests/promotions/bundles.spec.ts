/**
 * E2E tests for Promociones — Combos y paquetes (bundles).
 *
 * Covers:
 *  - list with data → create draft → publish OK
 *  - publish rejected shows ALL server errors together
 *  - FREE tier sees the blurred FeatureGate paywall (not a redirect)
 *
 * Route requires `discounts:read` permission (venueRoutes.tsx: menumaker/bundles ->
 * PermissionProtectedRoute permission="discounts:read") — the default VENUE_ALPHA
 * fixture does NOT grant discounts:* permissions, so every test here uses a venue
 * override that adds them. Without discounts:read even the FREE-paywall test would
 * never reach <FeatureGate>: it would hit the route guard's Access Denied screen
 * first (permission and tier are two independent gates — see CLAUDE.md "Activación
 * vs tier").
 */

import { expect, test } from '@playwright/test'

import { setupApiMocks } from '../../fixtures/api-mocks'
import { VENUE_ALPHA, VENUE_BETA } from '../../fixtures/mock-data'
import { setupPromotionMocks } from '../../fixtures/promotions-mocks'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

// 🔴 Chromium runs in ENGLISH by default and assertions here are in Spanish: pin
// the language BEFORE navigating. Real key verified in src/i18n.ts:174-176
// ('lang'); pattern from e2e/tests/master-catalog/catalog-core.spec.ts:8.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('lang', 'es'))
})

const VENUE_ALPHA_WITH_PROMOTIONS = {
  ...VENUE_ALPHA,
  permissions: [...VENUE_ALPHA.permissions, 'discounts:read', 'discounts:create', 'discounts:update', 'discounts:delete'],
}

test.describe('Promociones (combos y paquetes)', () => {
  test('combos está en Menú, Promociones permanece en Clientes y el enlace anterior conserva query y hash', async ({ page }) => {
    await setupApiMocks(page, {
      venues: [
        { ...VENUE_ALPHA_WITH_PROMOTIONS, permissions: [...VENUE_ALPHA_WITH_PROMOTIONS.permissions, 'coupons:read', 'upsells:read'] },
      ],
      planState: { hasPlan: true, state: 'active', planTier: 'PRO', grandfathered: false },
    })
    await setupPromotionMocks(page)

    await page.goto('/venues/venue-alpha/promotions/bundles?from=bookmark#details')
    await expect(page).toHaveURL(/\/venues\/venue-alpha\/menumaker\/bundles\?from=bookmark#details$/)
    await expect(page.locator('a[data-sidebar="menu-button"]').filter({ hasText: 'Combos y paquetes' })).toHaveAttribute(
      'href',
      '/venues/venue-alpha/menumaker/bundles',
    )

    // Volver del submenú antes de abrir Clientes (el panel principal está fuera de pantalla).
    await page.getByRole('button', { name: 'Menú', exact: true }).last().click()
    await page.getByRole('button', { name: 'Clientes', exact: true }).click()
    await page.getByRole('button', { name: 'Promociones', exact: true }).click()
    await expect(page.getByRole('link', { name: 'Descuentos', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Códigos de Cupón', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sugerencias al cobrar', exact: true })).toBeVisible()
    await expect(page.locator('a[data-sidebar="menu-button"]').filter({ hasText: 'Combos y paquetes' })).not.toBeVisible()
  })

  test('la nueva ruta conserva acceso con discounts:read sin exigir menu:read', async ({ page }) => {
    await setupApiMocks(page, {
      venues: [{ ...VENUE_ALPHA, permissions: ['discounts:read'] }],
      planState: { hasPlan: true, state: 'active', planTier: 'PRO', grandfathered: false },
    })
    await setupPromotionMocks(page)

    await page.goto('/venues/venue-alpha/menumaker/bundles')
    await expect(page.getByText('Combo del día')).toBeVisible()
    await expect(page.locator('a[data-sidebar="menu-button"]').filter({ hasText: 'Combos y paquetes' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Productos', exact: true })).not.toBeVisible()
  })

  test('marca blanca mantiene combos disponible sin habilitar el resto del Menú', async ({ page }) => {
    const venue = {
      ...VENUE_ALPHA_WITH_PROMOTIONS,
      modules: [
        {
          module: { id: 'mod-wl', code: 'WHITE_LABEL_DASHBOARD', name: 'White Label Dashboard' },
          enabled: true,
          config: { version: '1.0', theme: {}, navigation: { items: [] }, enabledFeatures: [{ code: 'AVOQADO_PROMOTIONS' }] },
        },
      ],
    }
    await setupApiMocks(page, {
      venues: [venue],
      planState: { hasPlan: true, state: 'active', planTier: 'PRO', grandfathered: false },
    })
    await setupPromotionMocks(page)
    await page.route('**/api/v1/me/access*', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          userId: 'user-test-001',
          venueId: venue.id,
          organizationId: venue.organizationId,
          role: 'OWNER',
          corePermissions: venue.permissions,
          whiteLabelEnabled: true,
          enabledFeatures: ['AVOQADO_PROMOTIONS'],
          featureAccess: { AVOQADO_PROMOTIONS: { allowed: true } },
        }),
      }),
    )

    await page.goto('/wl/venues/venue-alpha/promotions/bundles?from=bookmark#details')
    await expect(page).toHaveURL(/\/wl\/venues\/venue-alpha\/menumaker\/bundles\?from=bookmark#details$/)
    await expect(page.getByRole('button', { name: 'Menú', exact: true })).toHaveCount(2, { timeout: 3000 })
    await expect(page.locator('a[data-sidebar="menu-button"]').filter({ hasText: 'Combos y paquetes' })).toHaveAttribute(
      'href',
      '/wl/venues/venue-alpha/menumaker/bundles',
    )
    await expect(page.getByRole('link', { name: 'Productos', exact: true })).not.toBeVisible()
  })

  test('lista, crea y publica', async ({ page }) => {
    await setupApiMocks(page, {
      venues: [VENUE_ALPHA_WITH_PROMOTIONS, VENUE_BETA],
      planState: { hasPlan: true, state: 'active', planTier: 'PRO', grandfathered: false },
    })
    await setupPromotionMocks(page)

    await page.goto('/venues/venue-alpha/promotions/bundles')
    await expect(page.getByText('Combo del día')).toBeVisible()
    await expect(page.getByText('Martes 2x1')).toBeVisible()

    await page.locator('[data-tour="bundle-create"]').click()
    await page.getByPlaceholder('Combo del día').fill('Combo prueba')
    // The schema requires a group name + a chosen product — without this the
    // submit never fires (audit 2026-08-14). The product comes from the products mock.
    await page.getByPlaceholder('Ej. Elige tu plato').fill('Plato')
    await page.locator('[data-tour="bundle-product-0-0"]').click()
    await page.getByText('Hamburguesa mock').click()
    await page.locator('[data-tour="bundle-save"]').click()
    // The toast text is duplicated by an aria-live announcer ("Notification …") —
    // scope to the first match instead of the ambiguous plain-text locator.
    await expect(page.getByText(/Borrador guardado/).first()).toBeVisible()

    await page.locator('[data-tour="bundle-row-actions"]').first().click()
    // "Publicar" also appears in the activation banner copy ("crear, publicar y
    // elegir…") — target the dropdown menu item by role instead.
    await page.getByRole('menuitem', { name: 'Publicar' }).click()
    await expect(page.getByText(/ya aparece en el POS/).first()).toBeVisible()
  })

  test('publicar reprobado muestra TODOS los errores juntos', async ({ page }) => {
    await setupApiMocks(page, {
      venues: [VENUE_ALPHA_WITH_PROMOTIONS, VENUE_BETA],
      planState: { hasPlan: true, state: 'active', planTier: 'PRO', grandfathered: false },
    })
    await setupPromotionMocks(page, { publishFails: true })

    await page.goto('/venues/venue-alpha/promotions/bundles')
    await page.locator('[data-tour="bundle-row-actions"]').first().click()
    await page.getByRole('menuitem', { name: 'Publicar' }).click()

    await expect(page.getByText('Así no se puede publicar')).toBeVisible()
    await expect(page.getByText('El producto p1 está desactivado.')).toBeVisible()
    await expect(page.getByText('El grupo "Plato" no tiene opciones.')).toBeVisible()
  })

  test('FREE ve el paywall con candado, no un redirect', async ({ page }) => {
    await setupApiMocks(page, {
      venues: [VENUE_ALPHA_WITH_PROMOTIONS, VENUE_BETA],
      planState: { planTier: 'GRATIS', grandfathered: false },
    })
    await setupPromotionMocks(page)

    await page.goto('/venues/venue-alpha/promotions/bundles')
    // 🔴 FeatureGate ALWAYS mounts children (only blurs them) — asserting on
    // /PRO/i alone is a hollow match: "Nueva promoción" also contains "pro" and
    // is visible even if the gate is broken. Assert the paywall's EXCLUSIVE copy
    // (billing.json featureGate.upgrade, interpolated: "Mejora a {{tier}}" → "Mejora a Pro").
    await expect(page.getByText('Mejora a Pro')).toBeVisible()

    // Negative behavioral check: the blurred content sits behind
    // pointer-events-none (FeatureGate.tsx), so the create button underneath
    // must NOT be clickable — clicking it must never open the editor.
    await page
      .locator('[data-tour="bundle-create"]')
      .click({ timeout: 3000 })
      .catch(() => {})
    await expect(page.locator('[data-tour="bundle-save"]')).not.toBeVisible()
  })
})
