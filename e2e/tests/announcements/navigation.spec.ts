import { test, expect } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'

test('anuncio publicado durante la sesión aparece al navegar; cerrarlo no bloquea el siguiente', async ({ page }, testInfo) => {
  await setupApiMocks(page, { venueCount: 1 })
  await page.addInitScript(() => localStorage.setItem('lang', 'es'))
  let pending: { id: string; title: string } | null = null
  const dismissed: string[] = []
  let reads = 0
  await page.route('**/api/v1/dashboard/announcements/home', route => {
    reads++
    return route.fulfill({
      json: {
        success: true,
        data: {
          banner: null,
          modal: pending && !dismissed.includes(pending.id) ? {
            ...pending,
            body: 'FULLTEST: anuncio de prueba local.',
            priority: 'NORMAL',
            showAsModal: true,
            showAsBanner: false,
          } : null,
        },
      },
    })
  })
  await page.route('**/api/v1/dashboard/announcements/*/dismiss', route => {
    dismissed.push(new URL(route.request().url()).pathname.split('/').at(-2)!)
    return route.fulfill({ json: { success: true } })
  })

  await page.goto('/venues/venue-gen-0/settings/preferences')
  const closeDevtools = page.getByRole('button', { name: 'Close tanstack query devtools', exact: true })
  await closeDevtools.click()
  await expect(page.locator('[data-tour="settings-preferences-page"]')).toBeVisible()
  await expect.poll(() => reads).toBeGreaterThan(0)
  await expect(page.getByRole('dialog')).toHaveCount(0)

  pending = { id: 'c0000000000000000000000001', title: 'FULLTEST: primer anuncio' }
  await page.locator('[data-tour="settings-nav-profile"]:visible').click()
  await expect(page).toHaveURL(/\/settings\/profile$/)
  await expect(page.getByRole('dialog', { name: pending.title })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('announcement-desktop.png'), animations: 'disabled' })
  await page.setViewportSize({ width: 390, height: 844 })
  const bounds = await page.getByRole('dialog', { name: pending.title }).boundingBox()
  expect(bounds?.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
  await page.screenshot({ path: testInfo.outputPath('announcement-mobile.png'), animations: 'disabled' })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole('button', { name: 'Ahora no', exact: true }).click()
  await expect.poll(() => dismissed).toEqual([pending!.id])

  await page.locator('[data-tour="settings-nav-preferences"]:visible').click()
  await expect(page.locator('[data-tour="settings-preferences-page"]')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  pending = { id: 'c0000000000000000000000002', title: 'FULLTEST: segundo anuncio' }
  await page.locator('[data-tour="settings-nav-profile"]:visible').click()
  await expect(page.getByRole('dialog', { name: pending.title })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect.poll(() => dismissed).toEqual(['c0000000000000000000000001', pending!.id])
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
