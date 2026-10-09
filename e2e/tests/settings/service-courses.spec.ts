import { test, expect } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { SERVICE_COURSE_VENUES, setupServiceCourseMocks } from '../../fixtures/service-courses-mocks'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lang', 'es'))
  await setupApiMocks(page, {
    venues: SERVICE_COURSE_VENUES,
    planState: { hasPlan: true, state: 'active', planTier: 'PRO', grandfathered: false },
  })
  await setupServiceCourseMocks(page)
})

test('branch customization, canonical switcher and separate organization dashboard preserve scope', async ({ page }) => {
  await page.goto('/venues/venue-alpha/settings/service-courses')
  const closeDevtools = page.locator('button[aria-label="Close tanstack query devtools"]')
  if (await closeDevtools.isVisible()) await closeDevtools.click()
  await expect(page.getByText('La Mesa · Roma', { exact: true })).toBeVisible()
  await expect(page.locator('[data-tour="service-courses-page"]').getByRole('combobox')).toHaveCount(0)
  await page.getByRole('button', { name: 'Personalizar esta sucursal', exact: true }).click()
  await page.getByRole('textbox', { name: 'Nombre del tiempo 3', exact: true }).fill('Platos fuertes')
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
  await expect(page.getByText('Usa tiempos propios de esta sucursal')).toBeVisible()
  await expect(page.getByText('Platos fuertes', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Ir al dashboard de organización', exact: true }).click()
  await expect(page).toHaveURL(/\/organizations\/org-test-001\/settings\/service-courses/)
  await expect(page.getByText('Configuración de la organización', { exact: true })).toBeVisible()
  await expect(page.getByText('Principales', { exact: true })).toBeVisible()
  await expect(page.getByText('1 de 2 sucursales heredan la lista compartida.')).toBeVisible()
  await page.getByRole('link', { name: 'Volver a la sucursal', exact: true }).click()
  await expect(page.getByText('Platos fuertes', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /R Roma.*Pro/ }).click()
  await page.getByRole('option', { name: /Condesa/ }).click()
  await expect(page).toHaveURL(/\/venues\/venue-beta\/settings\/service-courses/)
  await expect(page.getByText('La Mesa · Condesa', { exact: true })).toBeVisible()
  await expect(page.getByText('Principales', { exact: true })).toBeVisible()
  await expect(page.getByText('Platos fuertes', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: /C Condesa.*Pro/ }).click()
  await page.getByRole('option', { name: /Roma/ }).click()
  await expect(page.getByText('Platos fuertes', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Usar lista compartida', exact: true }).click()
  await page.getByRole('button', { name: 'Volver a heredar', exact: true }).click()
  await expect(page.getByText('Hereda los tiempos de la organización', { exact: true })).toBeVisible()
})

test('Free keeps the feature visible and explains Pro', async ({ page }) => {
  await setupApiMocks(page, { venues: SERVICE_COURSE_VENUES, planState: { planTier: 'GRATIS', grandfathered: false } })
  await setupServiceCourseMocks(page, false)
  await page.goto('/venues/venue-alpha/settings/service-courses')
  await expect(page.getByRole('heading', { name: 'Tiempos de servicio', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Personalizar esta sucursal' })).toHaveCount(0)
  await expect(page.locator('[data-tour="service-courses-page"]')).toContainText('Pro')
})
