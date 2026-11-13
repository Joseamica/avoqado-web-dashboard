/**
 * E2E — Promociones de lealtad (sello doble, puntos dobles). Las obligatorias del repo (testing-and-git.md):
 *   1. escribir y VER el resultado: crear una promo la deja en «Scheduled» SIN recargar, y «End now» la pasa a «Ended»;
 *      un doble clic en «Create» manda UN alta;
 *   3. cargando ≠ vacío ≠ error: cada uno se ve distinto.
 * Más: el paginador cuando hay más de una página (20 por página, como la pide la pantalla).
 * Respuestas fingidas con la forma de la API del servidor (`{ items, total, page, pageSize }`, sin envoltura): prueban el
 * navegador, no el servidor. Locale E2E: inglés.
 */
import { test, expect, type Page } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { StaffRole, createMockVenue } from '../../fixtures/mock-data'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

const VENUE = createMockVenue({
  id: 'venue-alpha',
  name: 'Café Centro',
  slug: 'venue-alpha',
  permissions: ['home:read', 'customers:read', 'loyalty:read', 'loyalty:update'],
})
const PRO = { hasPlan: true, state: 'active', planTier: 'PRO', grandfathered: false } as const
const URL_PAGINA = '/venues/venue-alpha/loyalty/promotions'

/** El negocio da sellos y puntos: la frase menciona los dos. */
const CONFIG = {
  id: 'ccfg0000000000000000000000',
  venueId: 'venue-alpha',
  pointsPerDollar: 1,
  pointsPerVisit: 0,
  redemptionRate: 0.01,
  minPointsRedeem: 100,
  pointsExpireDays: null,
  active: true,
  stampsEnabled: true,
  stampsRequired: 10,
  maxStampsPerDay: 1,
  stampRewardType: 'FREE_PRODUCT',
  stampRewardValue: null,
  stampRewardProductId: null,
  stampRewardLabel: 'Free coffee',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
}

type Promo = Record<string, unknown> & { id: string; name: string; status: 'ACTIVE' | 'SCHEDULED' | 'ENDED'; startsAt: string }

const promo = (id: string, name: string, status: Promo['status'], over: Partial<Promo> = {}): Promo => ({
  id,
  name,
  kind: 'MULTIPLY',
  multiplier: 2,
  extraStamps: null,
  extraPoints: null,
  status,
  startsAt: '2026-11-13T06:00:00.000Z',
  endsAt: '2026-11-18T05:59:59.999Z',
  endedAt: null,
  startDate: '2026-11-13',
  endDate: '2026-11-17',
  daysOfWeek: [],
  timeFrom: null,
  timeUntil: null,
  productIds: [],
  categoryIds: [],
  products: [],
  categories: [],
  minSpend: null,
  limit: 'NONE',
  createdAt: '2026-11-12T18:00:00.000Z',
  updatedAt: '2026-11-12T18:00:00.000Z',
  ...over,
})

type Estado = {
  promos: Promo[]
  /** Los cuerpos que llegaron a `POST /loyalty/promotions`. */
  altas: Array<Record<string, unknown>>
  /** Los ids que llegaron a `POST …/:id/end`. */
  terminadas: string[]
  /** Cada `GET` de la lista, con su estado y página. */
  lecturas: string[]
  /** La lista contesta 500. */
  falla: boolean
  /** Si existe, la lista espera a esta promesa antes de contestar. */
  espera: Promise<void> | null
}
const estado = (over: Partial<Estado> = {}): Estado => ({
  promos: [],
  altas: [],
  terminadas: [],
  lecturas: [],
  falla: false,
  espera: null,
  ...over,
})
const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })

/** `/loyalty/config` y `/loyalty/promotions`, registrados DESPUÉS de setupApiMocks para ganar (Playwright es LIFO). */
async function mockLealtad(page: Page, s: Estado) {
  await page.route(
    url => url.pathname.includes('/api/v1/dashboard/venues/') && url.pathname.includes('/loyalty/'),
    async route => {
      const req = route.request()
      const url = new URL(req.url())
      if (url.pathname.endsWith('/loyalty/config')) return route.fulfill(json(CONFIG))
      const ruta = url.pathname.replace(/^.*\/loyalty\/promotions/, '')
      if (ruta === '' && req.method() === 'GET') {
        const status = url.searchParams.get('status') ?? ''
        const page = Number(url.searchParams.get('page') ?? '1')
        const pageSize = Number(url.searchParams.get('pageSize') ?? '50')
        s.lecturas.push(`${status}:${page}`)
        if (s.espera) await s.espera
        if (s.falla) return route.fulfill(json({ success: false, message: 'Se cayó la base' }, 500))
        const todas = s.promos.filter(p => p.status === status).sort((a, b) => b.startsAt.localeCompare(a.startsAt))
        return route.fulfill(json({ items: todas.slice((page - 1) * pageSize, page * pageSize), total: todas.length, page, pageSize }))
      }
      if (ruta === '' && req.method() === 'POST') {
        const body = req.postDataJSON() as Record<string, unknown>
        s.altas.push(body)
        const nueva = promo(`cpromo${String(s.altas.length).padStart(20, '0')}`, String(body.name), 'SCHEDULED', {
          ...body,
          startsAt: `${String(body.startDate)}T06:00:00.000Z`,
          endsAt: null,
        })
        s.promos.push(nueva)
        return route.fulfill(json(nueva, 201))
      }
      const fin = /^\/([^/]+)\/end$/.exec(ruta)
      if (fin && req.method() === 'POST') {
        s.terminadas.push(fin[1])
        const p = s.promos.find(x => x.id === fin[1])
        if (!p) return route.fulfill(json({ message: 'La promoción no existe' }, 404))
        p.status = 'ENDED'
        p.endedAt = new Date().toISOString()
        return route.fulfill(json(p))
      }
      return route.fulfill(json({}))
    },
  )
}

async function hideDevtools(page: Page) {
  await page.addInitScript(() => {
    const style = document.createElement('style')
    style.textContent = '.tsqd-parent-container { display: none !important; }'
    if (document.head) document.head.appendChild(style)
    else document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style))
  })
}

async function abrir(page: Page, s: Estado) {
  await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState: PRO })
  await mockLealtad(page, s)
  await hideDevtools(page)
  await page.goto(URL_PAGINA)
}

const grupo = (page: Page, status: 'ACTIVE' | 'SCHEDULED' | 'ENDED') => page.getByTestId(`loyalty-promo-group-${status}`)
const VACIO = "You don't have loyalty promotions yet"
const ERROR = "We couldn't load this information. Please try again."
const cargando = (page: Page) => page.locator('[aria-busy="true"][aria-label="Loading promotions…"]')

test.describe('Promociones de lealtad', () => {
  test('obligatoria 1: crear la deja en «Scheduled» SIN recargar, y «End now» la pasa a «Ended»', async ({ page }) => {
    const s = estado()
    await abrir(page, s)
    await expect(page.getByText(VACIO)).toBeVisible({ timeout: 15_000 })

    await page.locator('[data-tour="loyalty-promo-new-btn"]').click()
    await page.getByLabel('Name', { exact: true }).fill('Black Friday double stamps')
    await page.getByLabel('No end').click()
    await expect(page.getByTestId('loyalty-promo-preview')).toContainText('every visit gives 2 stamps instead of 1 and double points.')
    // Un doble clic programado (los dos clics en el mismo instante) manda UN alta.
    await page.locator('[data-tour="loyalty-promo-submit"]').dblclick()
    await expect.poll(() => s.altas.length).toBe(1)
    expect(s.altas[0]).toMatchObject({ name: 'Black Friday double stamps', kind: 'MULTIPLY', multiplier: 2, endDate: null, limit: 'NONE' })

    // 🔴 esto es la prueba, no el toast:
    await expect(grupo(page, 'SCHEDULED')).toContainText('Black Friday double stamps')
    await expect(grupo(page, 'SCHEDULED')).toContainText('every visit gives 2 stamps instead of 1 and double points.')
    await expect(page.getByText(VACIO)).toHaveCount(0)
    expect(s.altas).toHaveLength(1)

    await grupo(page, 'SCHEDULED').getByRole('button', { name: 'End now' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'End now' }).click()
    await expect.poll(() => s.terminadas).toEqual([s.promos[0].id])
    await expect(grupo(page, 'ENDED')).toContainText('Black Friday double stamps')
    await expect(grupo(page, 'SCHEDULED')).toHaveCount(0)
    // Terminada: sin acciones.
    await expect(grupo(page, 'ENDED').getByRole('button', { name: 'End now' })).toHaveCount(0)
  })

  test('obligatoria 3: cargando, vacío y error se ven distintos', async ({ page }) => {
    let soltar: () => void = () => {}
    const s = estado({ espera: new Promise<void>(r => (soltar = r)) })
    await abrir(page, s)

    // Cargando: el esqueleto, sin el «vacío» ni el error.
    await expect(cargando(page).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(VACIO)).toHaveCount(0)
    await expect(page.getByText(ERROR)).toHaveCount(0)

    // Vacío: el aviso de que no hay ninguna, sin esqueleto ni error.
    soltar()
    await expect(page.getByText(VACIO)).toBeVisible()
    await expect(cargando(page)).toHaveCount(0)
    await expect(page.getByText(ERROR)).toHaveCount(0)
  })

  test('obligatoria 3: un error del servidor NO se ve como «no hay promociones»', async ({ page }) => {
    const s = estado({ falla: true })
    await abrir(page, s)
    // `retry: 1`: el aviso sale tras el reintento.
    await expect(page.getByText(ERROR).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(VACIO)).toHaveCount(0)
    await expect(cargando(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Retry' }).first()).toBeVisible()
  })

  test('paginador: con 25 terminadas se ven 20, y «Next» trae las otras 5 con el total', async ({ page }) => {
    const promos = Array.from({ length: 25 }, (_, i) =>
      promo(`cpromoended${String(i + 1).padStart(14, '0')}`, `Promo ${i + 1}`, 'ENDED', {
        // La 1 empezó al último: el servidor ordena por inicio, de la más nueva a la más vieja.
        startsAt: new Date(Date.UTC(2026, 9, 31 - i)).toISOString(),
      }),
    )
    const s = estado({ promos })
    await abrir(page, s)

    const terminadas = grupo(page, 'ENDED')
    await expect(terminadas).toContainText('1–20 of 25', { timeout: 15_000 })
    await expect(terminadas.getByText('Promo 20', { exact: true })).toBeVisible()
    await expect(terminadas.getByText('Promo 21', { exact: true })).toHaveCount(0)

    await terminadas.getByRole('button', { name: 'Next' }).click()
    await expect(terminadas).toContainText('21–25 of 25')
    await expect(terminadas.getByText('Promo 21', { exact: true })).toBeVisible()
    await expect(terminadas.getByText('Promo 1', { exact: true })).toHaveCount(0)
    expect(s.lecturas).toContain('ENDED:2')
    await expect(terminadas.getByRole('button', { name: 'Next' })).toBeDisabled()

    await terminadas.getByRole('button', { name: 'Previous' }).click()
    await expect(terminadas).toContainText('1–20 of 25')
  })
})
