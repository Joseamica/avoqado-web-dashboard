/**
 * E2E tests for Upsell "¿Algo más?" — creating a rule.
 *
 * Covers:
 *  - happy path: pick the suggested product, resolve its required options, see the
 *    FINAL price in the preview, create — and assert the payload that reaches the API
 *  - trigger by product: "Crear" stays locked until a triggering product is chosen
 *  - a vetoed product is still listed (grayed out, with the reason) and can't be picked
 *
 * The create flow lives in a `FullScreenModal` (mandatory per .claude/rules/ui-patterns.md:
 * Close left / Title center / Submit right), so the button that creates sits in the
 * modal HEADER and submits the form by `form=` + `type="submit"`, ProductWizardDialog-style.
 * Asserting through `[data-tour="upsell-rule-submit"]` keeps the test honest about that.
 *
 * Route requires `upsells:read` (venueRoutes.tsx) and the "Nueva" button requires
 * `upsells:create` — the default VENUE_ALPHA fixture grants NEITHER, so every test here
 * uses a venue override. The page also self-gates with <FeatureGate feature="UPSELL">,
 * which is PRO (plan-catalog.ts) — permission and tier are two independent gates.
 */

import { expect, test, type Page } from '@playwright/test'

import { setupApiMocks } from '../../fixtures/api-mocks'
import { VENUE_ALPHA, VENUE_BETA } from '../../fixtures/mock-data'
import { setupUpsellMocks } from '../../fixtures/upsell-mocks'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

// 🔴 Chromium runs in ENGLISH by default and the assertions here are in Spanish (the
// page is hardcoded Spanish, no t()). Pin the language BEFORE navigating — it also
// pins Currency() to es-MX ("$50.00", not "50,00 MXN"). Real key verified in src/i18n.ts.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('lang', 'es'))
})

const VENUE_ALPHA_CON_UPSELL = {
  ...VENUE_ALPHA,
  permissions: [...VENUE_ALPHA.permissions, 'upsells:read', 'upsells:create', 'upsells:update'],
}

const PRO_PLAN = { hasPlan: true, state: 'active', planTier: 'PRO', grandfathered: false } as const

/**
 * Close TanStack Query DevTools if open, then hide via CSS as fallback.
 * ReactQueryDevtools mounts with `initialIsOpen` in App.tsx and its panel covers the
 * bottom of the viewport — exactly where the "Activas" card (and its "Nueva" button)
 * lands on this page, so without this every click here times out on an intercepted
 * pointer event. Mirrors the same helper in e2e/tests/settings/settings-hub.spec.ts.
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

async function abrirAltaDeSugerencia(page: Page) {
  await page.goto('/venues/venue-alpha/promotions/upsell')
  await expect(page.getByRole('heading', { name: 'Sugerencias al cobrar' })).toBeVisible()
  await closeTanStackDevTools(page)

  await page.locator('[data-tour="upsell-rule-new"]').click()
  // El modal es de pantalla completa: su título va al centro del encabezado. Se
  // busca por rol porque FullScreenModal repite el título en una <p class="sr-only">
  // (su DialogPrimitive.Description), y un getByText plano choca con las dos.
  await expect(page.getByRole('heading', { name: 'Nueva sugerencia' })).toBeVisible()

  // 🔴 Lo que hace que este test valga como red del PATRÓN y no sólo del flujo
  // (ui-patterns.md: "Cerrar izquierda / Título centro / Enviar derecha", contenido
  // sobre `bg-muted/30`). Con el `<Dialog>` de antes, el botón de crear vivía en un
  // DialogFooter al fondo: estas tres afirmaciones se caen si alguien lo revierte.
  await expect(page.locator('header [data-tour="upsell-rule-submit"]')).toBeVisible()
  await expect(page.locator('header button', { hasText: 'Cerrar' })).toBeVisible()
  await expect(page.locator('main[data-fsm-content]')).toHaveClass(/bg-muted\/30/)
}

test.describe('Sugerencias al cobrar (upsell)', () => {
  test('crea una sugerencia y muestra el precio FINAL antes de guardar', async ({ page }) => {
    await setupApiMocks(page, { venues: [VENUE_ALPHA_CON_UPSELL, VENUE_BETA], planState: PRO_PLAN })
    const mocks = await setupUpsellMocks(page)

    await abrirAltaDeSugerencia(page)

    const crear = page.locator('[data-tour="upsell-rule-submit"]')
    const preview = page.locator('[data-tour="upsell-rule-preview"]')

    // Sin producto elegido no hay nada que crear, y la vista previa dice qué falta
    // en vez de inventarse un precio.
    await expect(crear).toBeDisabled()
    await expect(preview).toContainText('Elige el producto a sugerir')

    await page.locator('[data-tour="upsell-rule-suggested-product"]').click()
    await page.getByRole('option', { name: /Agua Mineral 1L/ }).click()

    // Pide opciones obligatorias: sigue bloqueado hasta resolverlas, y la vista
    // previa muestra por ahora el precio de la ficha.
    await expect(crear).toBeDisabled()
    await expect(preview).toContainText('Agua Mineral 1L')
    await expect(preview).toContainText('$35.00')

    await page.locator('[data-tour="upsell-rule-modifier-g-tamano"]').click()
    await page.getByRole('option', { name: 'Grande', exact: false }).click()

    // 🔴 La razón de ser de la tarjeta (spec §4.2): el precio que verá el cliente NO
    // es el de la ficha — el modificador obligatorio le suma $15.
    await expect(preview).toContainText('Agua Mineral 1L (Grande)')
    await expect(preview).toContainText('$50.00')

    await page.locator('[data-tour="upsell-rule-headline"]').fill('¿Le agregamos un agua?')

    await expect(crear).toBeEnabled()
    await crear.click()

    // El toast se duplica en el anunciador aria-live: primer match.
    await expect(page.getByText('Sugerencia creada').first()).toBeVisible()
    expect(mocks.lastCreatePayload()).toMatchObject({
      triggerType: 'ALWAYS',
      suggestedProductId: 'p-agua',
      suggestedModifiers: [{ groupId: 'g-tamano', modifierId: 'm-grande' }],
      headline: '¿Le agregamos un agua?',
    })
  })

  test('el disparador por producto exige elegir cuál antes de dejar crear', async ({ page }) => {
    await setupApiMocks(page, { venues: [VENUE_ALPHA_CON_UPSELL, VENUE_BETA], planState: PRO_PLAN })
    const mocks = await setupUpsellMocks(page)

    await abrirAltaDeSugerencia(page)

    const crear = page.locator('[data-tour="upsell-rule-submit"]')

    // Café americano no pide opciones: con él solo, ya se podría crear.
    await page.locator('[data-tour="upsell-rule-suggested-product"]').click()
    await page.getByRole('option', { name: /Café americano/ }).click()
    await expect(crear).toBeEnabled()

    // Al cambiar a "sólo si ya llevan cierto producto" vuelve a bloquearse: falta decir cuál.
    await page.locator('[data-tour="upsell-rule-trigger-type"]').click()
    await page.getByRole('option', { name: 'Sólo si ya llevan cierto producto' }).click()
    await expect(crear).toBeDisabled()

    await page.locator('[data-tour="upsell-rule-trigger-product"]').click()
    await page.getByRole('option', { name: /Ensalada de la casa/ }).click()
    await expect(crear).toBeEnabled()
    await crear.click()

    await expect(page.getByText('Sugerencia creada').first()).toBeVisible()
    expect(mocks.lastCreatePayload()).toMatchObject({
      triggerType: 'PRODUCT',
      triggerProductIds: ['p-vetado'],
      suggestedProductId: 'p-cafe',
      // Sin grupos obligatorios la selección viaja vacía, no ausente.
      suggestedModifiers: [],
      headline: null,
    })
  })

  test('el producto vetado se ve, con su motivo, pero no se puede elegir', async ({ page }) => {
    await setupApiMocks(page, { venues: [VENUE_ALPHA_CON_UPSELL, VENUE_BETA], planState: PRO_PLAN })
    await setupUpsellMocks(page)

    await abrirAltaDeSugerencia(page)

    await page.locator('[data-tour="upsell-rule-suggested-product"]').click()

    // 🔴 Nunca se filtra el catálogo: ver el motivo vale más que no ver el producto.
    const vetado = page.getByRole('option', { name: /Ensalada de la casa/ })
    await expect(vetado).toContainText('Vetado en su ficha')
    await expect(vetado).toHaveAttribute('aria-disabled', 'true')

    // El que sólo pide opciones NO está bloqueado: se resuelve aquí mismo.
    const pideOpciones = page.getByRole('option', { name: /Agua Mineral 1L/ })
    await expect(pideOpciones).toContainText('Pide elegir opciones')
    await expect(pideOpciones).not.toHaveAttribute('aria-disabled', 'true')
  })
})
