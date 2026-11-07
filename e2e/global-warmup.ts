import { chromium } from '@playwright/test'

import { setupApiMocks } from './fixtures/api-mocks'
import { VENUE_ALPHA } from './fixtures/mock-data'

/**
 * Sólo con el servidor de dev propio: Vite compila al primer pedido, y con varios workers el PRIMER test de cada uno
 * se encuentra la página en «Cargando…» y pierde el plazo del expect. Se abre la pantalla una vez, con la app ya
 * montada, antes de los tests. Si la app no monta, esto lanza error y NINGÚN test corre (no oculta nada).
 */
export default async function globalSetup() {
  if (process.env.E2E_BASE_URL) return
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await setupApiMocks(page, { venues: [VENUE_ALPHA] })
    await page.goto('http://localhost:5173/venues/venue-alpha/online-ordering', { waitUntil: 'networkidle', timeout: 120_000 })
    await page.getByRole('tablist').first().waitFor({ timeout: 120_000 })
  } finally {
    await browser.close()
  }
}
