/**
 * E2E — Tarjetas de regalo, panel (fase 1a, Parte D). Las tres obligatorias del repo (testing-and-git.md):
 *   1. escribir y VER el resultado: bloquear una tarjeta desde su detalle cambia su fila a «Blocked» SIN recargar; y prender
 *      la función en Configuración deja el switch prendido sin recargar;
 *   2. el buscador va al servidor y conserva el foco;
 *   3. vacío ≠ sin resultados ≠ error del servidor. Un 500 SIN `code` dice el texto genérico, nunca el `message` crudo
 *      (notas 10/12/17 del coordinador); con un filtro puesto, el buscador y los filtros se quedan tras el 500; con filas ya
 *      cargadas, una relectura que falla deja las filas y ofrece «Refresh»; y el aviso de ajustes sin `code` también es
 *      genérico (nota 18).
 * Más: Free sin tarjetas (`hasCards: false`) ⇒ el cartel «Included in Pro» en la página y en configuración; Free CON tarjetas ⇒
 * la lista con el aviso (ver saldos nunca se esconde); un CAJERO (sólo giftCards:read) ve saldos e historial pero ninguna acción
 * ni el switch; reportes con el aviso del server, los totales POR TIPO y el CSV tras el clic; y el modo oscuro. Respuestas
 * fingidas con la forma de HOY de C3/C4 (`cancel.message`, `notice`, `totals[kind]`): prueban el navegador, no el server.
 * Locale E2E: inglés.
 */
import { test, expect, type Locator, type Page } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { StaffRole, createMockVenue } from '../../fixtures/mock-data'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

const OWNER_PERMS = [
  'home:read',
  'settings:read',
  'orders:read',
  'tender-types:read',
  'giftCards:read',
  'giftCards:sell',
  'giftCards:redeem',
  'giftCards:manage',
  'billing:subscriptions:read',
  'billing:subscriptions:manage',
]
const VENUE = createMockVenue({ id: 'venue-alpha', name: 'IQ Collection', slug: 'venue-alpha', permissions: OWNER_PERMS })
/** Un cajero: vende, cobra y VE (giftCards:read), pero no administra. */
const CASHIER_VENUE = createMockVenue({
  id: 'venue-alpha',
  name: 'IQ Collection',
  slug: 'venue-alpha',
  permissions: ['home:read', 'giftCards:read', 'giftCards:sell', 'giftCards:redeem'],
})
const PRO = { hasPlan: true, state: 'active', planTier: 'PRO', grandfathered: false } as const
const FREE = { hasPlan: false, state: 'none', planTier: 'GRATIS', grandfathered: false } as const

/** El texto genérico del locale (errors.generic): lo que se ve con un error SIN `code`. */
const GENERICO = 'Something went wrong. Try again.'
/** El `message` crudo de un 500 sin `code`: NUNCA se pinta. */
const CRUDO = 'Se cayó la base'

type Ajustes = Record<string, unknown> & { enabled: boolean }
/**
 * Respuestas con la forma EXACTA de la red: ajustes = `GiftCardSettingsView` (A5) + `sale` + `hasCards` (C3; el manejador lo
 * calcula con las tarjetas fingidas); lista con `totalBalance` y el filtro `EXPIRED`; detalle con `cancel` (y su `message`) y
 * `currentBlock`; aging sin `expiredAmount`; pendientes con `notice` y `totals[kind]`; montos en pesos como número. El panel
 * las pinta TAL CUAL (F3: sin traductores).
 */
const VENTA_OK = { sellable: true, code: null, message: null, howToEnable: null, operationLimit: 69999.99 }
const SETTINGS_ON: Ajustes = {
  enabled: true,
  suggestedAmounts: [500, 1000, 2000],
  minAmount: 100,
  maxAmount: 10000,
  validityMonths: null,
  termsVersion: '2026-10-14',
  topePorOperacion: 69999.99,
  llavesConfiguradas: true,
  updatedAt: '2026-10-14T15:00:00.000Z',
  sale: VENTA_OK,
}
/** Nunca las ha usado: apagado y sin ninguna tarjeta. */
const SETTINGS_NUNCA: Ajustes = {
  ...SETTINGS_ON,
  enabled: false,
  updatedAt: null,
  sale: {
    sellable: false,
    code: 'GIFT_CARDS_DISABLED',
    message: 'Las tarjetas de regalo están apagadas en este negocio. Actívalas en tu panel: Ajustes › Tarjetas de regalo.',
    howToEnable: 'DASHBOARD_SETTINGS',
    operationLimit: 69999.99,
  },
}

/** Una fila de C4 (`GiftCardRow`). */
const tarjeta = (id: string, last4: string, recipientName: string, balance: number, orderNumber: string) => ({
  id,
  last4,
  status: 'ACTIVE',
  initialAmount: balance,
  balance,
  createdAt: '2026-10-10T18:00:00.000Z',
  activatedAt: '2026-10-10T18:01:00.000Z',
  expiresAt: null as string | null,
  deliveryChannel: 'WHATSAPP',
  deliveryStatus: 'SENT',
  recipientName,
  purchaserName: 'Luis Pérez',
  source: 'POS',
  customer: null,
  order: { id: `o-${id}`, orderNumber },
})
type Tarjeta = ReturnType<typeof tarjeta>

/** Lo que manda el server (`evaluarCancelacionDeVenta`, C4) cuando una tarjeta de la venta está bloqueada por OTRO motivo. */
const NO_CANCELA_BLOQUEADA = 'Una de las tarjetas de esta venta está bloqueada por otro motivo; desbloquéala antes de cancelar la venta.'

/** El detalle PLANO de C4 (`GiftCardDetail`), con su libreta más reciente primero (el BLOCK, si lo hubo). */
const detalle = (c: Tarjeta, motivoDeBloqueo?: string) => {
  const items = [
    ...(c.status === 'BLOCKED' && motivoDeBloqueo
      ? [
          {
            id: `blk-${c.id}`,
            type: 'BLOCK',
            amount: 0,
            balanceAfter: c.balance,
            reason: motivoDeBloqueo,
            note: null,
            createdAt: '2026-10-14T18:00:00.000Z',
            staff: { id: 'st-owner', name: 'Dueña' },
            paymentId: null,
            refundPaymentId: null,
            orderId: null,
          },
        ]
      : []),
    {
      id: `act-${c.id}`,
      type: 'ACTIVATE',
      amount: c.initialAmount,
      balanceAfter: c.initialAmount,
      reason: null,
      note: null,
      createdAt: c.activatedAt,
      staff: { id: 'st-caja', name: 'Caja 1' },
      paymentId: null,
      refundPaymentId: null,
      orderId: c.order.id,
    },
  ]
  const enCancelacion = motivoDeBloqueo === 'CANCEL_IN_PROGRESS'
  return {
    ...c,
    validityMonths: null,
    termsVersion: '2026-10-14',
    message: null,
    recipientPhone: null,
    recipientEmail: null,
    purchaserContact: null,
    deliveredAt: null,
    deactivatedAt: null,
    hasRedeem: false,
    canReplaceCode: true,
    // Lo calcula el server con el predicado de iniciarCancelacionDeVenta (B2); `message` = su texto cuando no se puede (nota 1).
    cancel:
      c.status === 'BLOCKED'
        ? enCancelacion
          ? { allowed: false, reason: 'IN_PROGRESS', message: null }
          : { allowed: false, reason: null, message: NO_CANCELA_BLOQUEADA }
        : { allowed: true, reason: null, message: null },
    // El bloqueo VIGENTE, de la consulta propia del server (auditoría r1, D-2); `null` si no está bloqueada.
    currentBlock:
      c.status === 'BLOCKED' && motivoDeBloqueo ? { reason: motivoDeBloqueo, note: null, at: '2026-10-14T18:00:00.000Z' } : null,
    activities: { items, nextCursor: null, total: items.length },
  }
}
const SUMMARY = {
  from: '2026-10-01',
  to: '2026-10-14',
  timezone: 'America/Mexico_City',
  sold: { cards: 4, amount: 6000 },
  redeemed: { movements: 3, amount: 1350, reversed: 100, net: 1250 },
  cancelled: { cards: 1, amount: 500 },
  adjustments: { increments: 100, decrements: 50, net: 50 },
  liveBalance: { cards: 3, amount: 4250, expiredAmount: 0, asOf: '2026-10-14T18:00:00.000Z' },
}
/** Sin `expiredAmount` (auditoría r1, C-4). */
const AGING = {
  at: '2026-10-14',
  timezone: 'America/Mexico_City',
  buckets: [{ bucket: '0-30', cards: 3, amount: 4250 }],
  total: { cards: 3, amount: 4250 },
}
const CERO = { count: 0, amount: 0, tipAmount: 0 }
/** El aviso al contador que manda el server (C4 `AVISO_PENDIENTES_CONTABLES`): se pinta tal cual, nunca se copia al locale. */
const AVISO_CONTADOR =
  'Estos cobros no generan póliza automática: regístralos a mano en la contabilidad. El costo de la mercancía que se pagó con saldo ya está en la póliza de costo de ventas; falta el ingreso del canje y, en la venta de tarjetas, el saldo que se le debe al cliente.'
/** Una venta de tarjetas pendiente de póliza, con sus totales POR TIPO (D5 r1: nunca sumados entre tipos). */
const PENDIENTES = {
  items: [
    {
      paymentId: 'pay-1',
      createdAt: '2026-10-10T18:01:00.000Z',
      kind: 'VENTA_DE_TARJETAS',
      amount: 1500,
      tipAmount: 0,
      method: 'CASH',
      tenderLabel: null,
      order: { id: 'o-gc1', orderNumber: 'A-1042' },
    },
  ],
  page: 1,
  pageSize: 50,
  total: 1,
  from: '2026-10-01',
  to: '2026-10-14',
  totals: {
    VENTA_DE_TARJETAS: { count: 1, amount: 1500, tipAmount: 0 },
    CANCELACION_DE_VENTA: CERO,
    COBRO_CON_SALDO: CERO,
    REVERSO_DE_SALDO: CERO,
  },
  notice: AVISO_CONTADOR,
}
const ok = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
/** Un 500 SIN `code` (como los de `checkFeatureAccess` o una caída): la pantalla dice el texto genérico. */
const sinCodigo = () => ({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: CRUDO }) })

type Estado = {
  settings: Ajustes
  cards: Tarjeta[]
  /** Motivo del último bloqueo de cada tarjeta (lo que el server escribiría en su libreta). */
  bloqueos: Record<string, string>
  listError: boolean
  settingsError: boolean
  busquedas: string[]
  ops: Array<Record<string, unknown>>
  puts: Array<Record<string, unknown>>
  rutas: string[]
}
const estado = (over: Partial<Estado> = {}): Estado => ({
  settings: SETTINGS_ON,
  cards: [tarjeta('gc1', '4821', 'Ana López', 1500, 'A-1042'), tarjeta('gc2', '7710', 'Marta Ruiz', 500, 'A-1043')],
  bloqueos: {},
  listError: false,
  settingsError: false,
  busquedas: [],
  ops: [],
  puts: [],
  rutas: [],
  ...over,
})

/** Todo /gift-cards en UN manejador, registrado DESPUÉS de setupApiMocks para ganar (Playwright es LIFO). */
async function mockGiftCards(page: Page, s: Estado) {
  await page.route(
    url => url.pathname.includes('/api/v1/dashboard/venues/') && url.pathname.includes('/gift-cards'),
    async route => {
      const req = route.request()
      const url = new URL(req.url())
      const path = url.pathname.replace(/^.*\/gift-cards/, '') || '/'
      s.rutas.push(path)
      if (path === '/settings') {
        if (req.method() === 'PUT') {
          const body = req.postDataJSON() as Record<string, unknown>
          s.puts.push(body)
          const enabled = body.enabled === undefined ? s.settings.enabled : Boolean(body.enabled)
          s.settings = { ...s.settings, enabled, updatedAt: new Date().toISOString(), sale: enabled ? VENTA_OK : SETTINGS_NUNCA.sale }
        } else if (s.settingsError) {
          return route.fulfill(sinCodigo())
        }
        // `hasCards` (C3): ¿existe al menos una tarjeta del negocio, de cualquier estado?
        return route.fulfill(ok({ ...s.settings, hasCards: s.cards.length > 0 }))
      }
      if (path === '/') {
        const search = url.searchParams.get('search') ?? ''
        s.busquedas.push(search)
        if (s.listError) return route.fulfill(sinCodigo())
        const q = search.toLowerCase()
        // Estados como los filtra C4: los cuatro reales y `EXPIRED` (= ACTIVE con `expiresAt` ya pasado, en UTC).
        const estados = (url.searchParams.get('status') ?? '').split(',').filter(Boolean)
        const ahora = Date.now()
        const pasaEstado = (c: Tarjeta) =>
          estados.length === 0 ||
          estados.includes(c.status) ||
          (estados.includes('EXPIRED') && c.status === 'ACTIVE' && c.expiresAt != null && new Date(c.expiresAt).getTime() < ahora)
        const items = s.cards.filter(
          c => pasaEstado(c) && (!q || c.last4.toLowerCase().includes(q) || c.recipientName.toLowerCase().includes(q)),
        )
        const totalBalance = items.reduce((suma, c) => suma + c.balance, 0)
        return route.fulfill(ok({ items, page: 1, pageSize: 50, total: items.length, totalBalance }))
      }
      if (path === '/summary') return route.fulfill(ok(SUMMARY))
      if (path === '/aging') return route.fulfill(ok(AGING))
      if (path === '/pending-accounting') return route.fulfill(ok(PENDIENTES))
      if (path === '/export.csv') {
        return route.fulfill({
          status: 200,
          contentType: 'text/csv; charset=utf-8',
          headers: { 'content-disposition': 'attachment; filename="saldos-tarjetas-de-regalo-2026-10-14.csv"' },
          body: 'Últimos 4,Estado,Monto inicial,Saldo\n4821,ACTIVE,1500.00,1500.00\n',
        })
      }
      const op = /^\/([^/]+)\/operations$/.exec(path)
      if (op && req.method() === 'POST') {
        const body = req.postDataJSON() as Record<string, unknown>
        s.ops.push(body)
        const c = s.cards.find(x => x.id === op[1])
        if (c && body.tipo === 'BLOQUEAR') {
          c.status = 'BLOCKED'
          s.bloqueos[c.id] = String(body.reason)
        }
        return route.fulfill(ok({ activityIds: [`act-op-${s.ops.length}`] }))
      }
      const uno = /^\/([^/]+)$/.exec(path)
      const c = uno ? s.cards.find(x => x.id === uno[1]) : undefined
      if (c) return route.fulfill(ok(detalle(c, s.bloqueos[c.id])))
      return route.fulfill(ok({}))
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

async function darkMode(page: Page) {
  await page.evaluate(() => localStorage.setItem('vite-ui-theme', 'dark'))
  await page.reload()
}

const fila = (page: Page, last4: string): Locator => page.getByRole('row').filter({ hasText: `•••• ${last4}` })

/**
 * Cierra la hoja de detalle con su botón. No con Escape: tras una acción, el primer Escape cierra el aviso («Card blocked»),
 * que es la capa de arriba (Radix), y la hoja se queda abierta.
 */
async function cerrarHoja(page: Page) {
  const hoja = page.locator('[data-tour="gift-card-detail"]')
  await hoja.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(hoja).toHaveCount(0)
}

/** Abre el detalle de una tarjeta y la bloquea por «Actividad sospechosa». */
async function bloquear(page: Page, last4: string) {
  await fila(page, last4).click()
  const hoja = page.locator('[data-tour="gift-card-detail"]')
  await expect(hoja).toContainText('Activated')
  await page.locator('[data-tour="gift-card-block"]').click()
  await page.getByLabel('Suspicious activity').click()
  await page.locator('[data-tour="gift-card-block-confirm"]').click()
  return hoja
}

test.describe('Tarjetas de regalo — lista y detalle', () => {
  test('obligatoria 1: bloquear desde el detalle cambia la fila a «Blocked» SIN recargar, con su llave de operación', async ({ page }) => {
    const s = estado()
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState: PRO })
    await mockGiftCards(page, s)
    await hideDevtools(page)
    await page.goto('/venues/venue-alpha/gift-cards')
    await expect(fila(page, '4821')).toContainText('Active', { timeout: 15_000 })
    // Total y saldo de TODO el filtro, del server (`total` y `totalBalance`).
    await expect(page.locator('[data-tour="gift-cards-totals"]')).toContainText('2 cards')
    await expect(page.locator('[data-tour="gift-cards-totals"]')).toContainText('2,000.00')
    await page.screenshot({ path: 'test-results/gift-cards-list-light.png', fullPage: true })
    const hoja = await bloquear(page, '4821')
    await expect.poll(() => s.ops.length).toBe(1)
    expect(s.ops[0]).toMatchObject({ tipo: 'BLOQUEAR', reason: 'SUSPICIOUS_ACTIVITY' })
    expect(String(s.ops[0].operationKey).length).toBeGreaterThanOrEqual(8)
    await expect(hoja).toContainText('Blocked')
    // El motivo vigente sale de `currentBlock` del server (auditoría r1, D-2), no de la libreta.
    await expect(page.locator('[data-tour="gift-card-blocked-reason"]')).toContainText('Suspicious activity')
    // Nota 2: el «no se puede cancelar» es el texto del server (`cancel.message`), no el genérico del locale.
    await expect(page.locator('[data-tour="gift-card-cancel-sale-reason"]')).toHaveText(NO_CANCELA_BLOQUEADA)
    await page.screenshot({ path: 'test-results/gift-cards-detail-blocked-light.png' })
    await cerrarHoja(page)
    // 🔴 esto es la prueba, no el toast:
    await expect(fila(page, '4821')).toContainText('Blocked')
    expect(s.ops).toHaveLength(1)
  })

  test('obligatoria 2: el buscador va al servidor y conserva el foco', async ({ page }) => {
    const s = estado()
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState: PRO })
    await mockGiftCards(page, s)
    await hideDevtools(page)
    await page.goto('/venues/venue-alpha/gift-cards')
    await expect(fila(page, '7710')).toBeVisible({ timeout: 15_000 })
    await page.locator('[data-tour="gift-cards-search-open"]').click()
    const buscador = page.locator('[data-tour="gift-cards-search"]')
    await buscador.pressSequentially('4821', { delay: 60 })
    await expect(buscador).toBeFocused()
    await expect(buscador).toHaveValue('4821')
    await expect.poll(() => s.busquedas.at(-1)).toBe('4821')
    await expect(fila(page, '7710')).toHaveCount(0)
    await expect(fila(page, '4821')).toBeVisible()
    await expect(buscador).toBeFocused()
  })

  test('obligatoria 3: vacío ≠ sin resultados ≠ error del servidor (sin `code` ⇒ texto genérico; el buscador se queda)', async ({
    page,
  }) => {
    const s = estado({ cards: [] })
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState: PRO })
    await mockGiftCards(page, s)
    await hideDevtools(page)
    // vacío: prendidas pero ninguna vendida — dice «aún no vendes», no «sin resultados»
    await page.goto('/venues/venue-alpha/gift-cards')
    await expect(page.getByText("You haven't sold any gift cards yet")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('No gift card matches your search')).toHaveCount(0)
    // sin resultados: con tarjetas, una búsqueda que no coincide
    s.cards = [tarjeta('gc1', '4821', 'Ana López', 1500, 'A-1042')]
    s.settings = SETTINGS_ON
    await page.reload()
    await expect(fila(page, '4821')).toBeVisible({ timeout: 15_000 })
    await page.locator('[data-tour="gift-cards-search-open"]').click()
    const buscador = page.locator('[data-tour="gift-cards-search"]')
    await buscador.fill('zzzz')
    await expect(page.getByText('No gift card matches your search')).toBeVisible()
    await expect(page.getByText("You haven't sold any gift cards yet")).toHaveCount(0)
    // nota 18 (b): con un filtro puesto, una búsqueda que responde 500 deja a la vista el buscador y los filtros
    s.listError = true
    await buscador.fill('zzz9')
    await expect(page.getByText("We couldn't load the gift cards")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(GENERICO)).toBeVisible()
    await expect(page.getByText(CRUDO)).toHaveCount(0)
    await expect(buscador).toBeVisible()
    await expect(buscador).toHaveValue('zzz9')
    await expect(buscador).toBeFocused()
    await expect(page.locator('[data-filter-pill]')).toBeVisible()
    await page.screenshot({ path: 'test-results/gift-cards-search-error-light.png', fullPage: true })
    s.listError = false
    await page.locator('[data-tour="gift-cards-retry"]').click()
    await expect(page.getByText('No gift card matches your search')).toBeVisible()
    // error del servidor sin filtros: lo dice con el texto genérico (nota 17) y «Retry» lo recupera (nunca «no hay tarjetas»)
    s.listError = true
    await page.reload()
    await expect(page.getByText("We couldn't load the gift cards")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(GENERICO)).toBeVisible()
    await expect(page.getByText(CRUDO)).toHaveCount(0)
    await expect(page.getByText("You haven't sold any gift cards yet")).toHaveCount(0)
    s.listError = false
    await page.locator('[data-tour="gift-cards-retry"]').click()
    await expect(fila(page, '4821')).toBeVisible()
  })

  test('nota 18 (c): con filas cargadas, una relectura que falla las deja y ofrece «Refresh», que trae lo nuevo', async ({ page }) => {
    const s = estado()
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState: PRO })
    await mockGiftCards(page, s)
    await hideDevtools(page)
    await page.goto('/venues/venue-alpha/gift-cards')
    await expect(fila(page, '4821')).toContainText('Active', { timeout: 15_000 })
    // El bloqueo sale bien, pero la relectura de la lista que dispara responde 500 (sin `code`).
    s.listError = true
    const hoja = await bloquear(page, '4821')
    await expect(hoja).toContainText('Blocked')
    await cerrarHoja(page)
    const refrescar = page.getByRole('button', { name: 'Refresh' })
    await expect(refrescar).toBeVisible({ timeout: 15_000 })
    // Las filas que ya había se quedan (nunca «no hay tarjetas»), y el pie dice el texto genérico.
    await expect(fila(page, '4821')).toContainText('Active')
    await expect(fila(page, '7710')).toBeVisible()
    await expect(page.getByText(GENERICO)).toBeVisible()
    await expect(page.getByText(CRUDO)).toHaveCount(0)
    s.listError = false
    await refrescar.click()
    await expect(fila(page, '4821')).toContainText('Blocked')
    await expect(refrescar).toHaveCount(0)
  })

  test('nota 18 (a): si los ajustes fallan sin `code`, el aviso dice el texto genérico y la lista igual se ve', async ({ page }) => {
    const s = estado({ settingsError: true })
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState: PRO })
    await mockGiftCards(page, s)
    await hideDevtools(page)
    await page.goto('/venues/venue-alpha/gift-cards')
    await expect(page.getByText("We couldn't read how gift cards are set up.")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(GENERICO)).toBeVisible()
    await expect(page.getByText(CRUDO)).toHaveCount(0)
    // Ver saldos no depende de los ajustes.
    await expect(fila(page, '4821')).toBeVisible()
    s.settingsError = false
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(page.getByText("We couldn't read how gift cards are set up.")).toHaveCount(0)
  })

  test('un cajero (sólo giftCards:read) ve saldo e historial, pero ninguna acción ni el switch', async ({ page }) => {
    const s = estado()
    await setupApiMocks(page, { userRole: StaffRole.CASHIER, venues: [CASHIER_VENUE], planState: PRO })
    await mockGiftCards(page, s)
    await hideDevtools(page)
    await page.goto('/venues/venue-alpha/gift-cards')
    await expect(fila(page, '4821')).toBeVisible({ timeout: 15_000 })
    await fila(page, '4821').click()
    await expect(page.locator('[data-tour="gift-card-history"]')).toContainText('Activated')
    await expect(page.locator('[data-tour="gift-card-detail-balance"]')).toContainText('1,500.00')
    await expect(page.locator('[data-tour="gift-card-actions"]')).toHaveCount(0)
    await page.goto('/venues/venue-alpha/settings/gift-cards')
    await expect(page.getByText(/only a manager or the owner can change it/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('switch', { name: 'Sell gift cards' })).toBeDisabled()
    expect(s.ops).toHaveLength(0)
    expect(s.puts).toHaveLength(0)
  })

  test('reportes: cifras del agregado, aviso del server, totales por tipo y el CSV sólo tras el clic', async ({ page }) => {
    const s = estado()
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState: PRO })
    await mockGiftCards(page, s)
    await hideDevtools(page)
    await page.goto('/venues/venue-alpha/gift-cards#reports')
    await expect(page.getByText(/6,000\.00/)).toBeVisible({ timeout: 15_000 })
    // Pendientes contables: el aviso al contador es el del server (nota 3) y los totales van POR TIPO (D5 r1).
    await expect(page.locator('[data-tour="gift-cards-pending-notice"]')).toHaveText(AVISO_CONTADOR)
    const pendientes = page.locator('[data-tour="gift-cards-pending-accounting"]')
    await expect(pendientes).toContainText('1 operation in the period')
    await expect(pendientes).toContainText('Gift card sale (1): $1,500.00')
    await expect(pendientes).not.toContainText('Payment with balance (')
    expect(s.rutas).not.toContain('/export.csv')
    const descarga = page.waitForEvent('download')
    await page.locator('[data-tour="gift-cards-export"]').click()
    expect((await descarga).suggestedFilename()).toMatch(/^saldos-tarjetas-de-regalo-\d{4}-\d{2}-\d{2}\.csv$/)
    await page.screenshot({ path: 'test-results/gift-cards-reports-light.png', fullPage: true })
  })

  test('modo oscuro: lista y detalle con los tokens del tema', async ({ page }) => {
    const s = estado()
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState: PRO })
    await mockGiftCards(page, s)
    await hideDevtools(page)
    await page.goto('/venues/venue-alpha/gift-cards')
    await expect(fila(page, '4821')).toBeVisible({ timeout: 15_000 })
    await darkMode(page)
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect(fila(page, '4821')).toBeVisible({ timeout: 15_000 })
    await page.screenshot({ path: 'test-results/gift-cards-list-dark.png', fullPage: true })
    await fila(page, '4821').click()
    await expect(page.locator('[data-tour="gift-card-detail"]')).toContainText('Activated')
    // Captura del elemento: Playwright espera a que la hoja termine de entrar (una de página la toma a media animación).
    await page.locator('[data-tour="gift-card-detail"]').screenshot({ path: 'test-results/gift-cards-detail-dark.png' })
    await cerrarHoja(page)
    await page.goto('/venues/venue-alpha/gift-cards#reports')
    await expect(page.getByText(/6,000\.00/)).toBeVisible({ timeout: 15_000 })
    await page.screenshot({ path: 'test-results/gift-cards-reports-dark.png', fullPage: true })
  })
})

test.describe('Tarjetas de regalo — plan y configuración', () => {
  test('Free y nunca usadas (`hasCards: false`): la página de tarjetas y configuración enseñan el cartel «Included in Pro»', async ({
    page,
  }) => {
    const s = estado({ settings: SETTINGS_NUNCA, cards: [] })
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState: FREE })
    await mockGiftCards(page, s)
    await hideDevtools(page)
    await page.goto('/venues/venue-alpha/gift-cards')
    // DD2: sin plan y sin ninguna tarjeta vendida (lo dice `hasCards` de C3) ⇒ el cartel, no una lista vacía.
    await expect(page.getByText(/included in pro/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText("You haven't sold any gift cards yet")).toHaveCount(0)
    await page.screenshot({ path: 'test-results/gift-cards-page-paywall-light.png', fullPage: true })
    await page.goto('/venues/venue-alpha/settings/gift-cards')
    await expect(page.getByText(/included in pro/i)).toBeVisible({ timeout: 15_000 })
    expect(s.puts).toHaveLength(0)
    await page.screenshot({ path: 'test-results/gift-cards-settings-paywall-light.png', fullPage: true })
  })

  test('Free CON tarjetas vendidas: la lista se ve con el aviso (bajar de plan nunca esconde saldos)', async ({ page }) => {
    // Prendidas y con tarjetas, pero el plan Free ya no incluye vender: el aviso «NOT_IN_PLAN» lo decide el panel con el plan.
    const s = estado({ settings: SETTINGS_ON })
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState: FREE })
    await mockGiftCards(page, s)
    await hideDevtools(page)
    await page.goto('/venues/venue-alpha/gift-cards')
    await expect(fila(page, '4821')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/your plan no longer includes selling gift cards/i)).toBeVisible()
    await expect(page.getByText(/included in pro/i)).toHaveCount(0)
  })

  test('obligatoria 1 (configuración): prender con las reglas aceptadas deja el switch prendido SIN recargar', async ({ page }) => {
    const s = estado({ settings: SETTINGS_NUNCA, cards: [] })
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState: PRO })
    await mockGiftCards(page, s)
    await hideDevtools(page)
    await page.goto('/venues/venue-alpha/settings/gift-cards')
    const sw = page.getByRole('switch', { name: 'Sell gift cards' })
    await expect(sw).not.toBeChecked({ timeout: 15_000 })
    await sw.click()
    const prender = page.locator('[data-tour="gift-cards-activate-confirm"]')
    await expect(prender).toBeDisabled()
    await page.locator('#gift-cards-consent').click()
    await prender.click()
    await expect.poll(() => s.puts.length).toBe(1)
    expect(s.puts[0]).toEqual({ enabled: true, aceptaTerminos: true })
    // 🔴 la prueba: el switch quedó prendido con lo que devolvió el server, sin recargar
    await expect(page.getByRole('switch', { name: 'Sell gift cards' })).toBeChecked()
    await page.screenshot({ path: 'test-results/gift-cards-settings-on-light.png', fullPage: true })
    await darkMode(page)
    await expect(page.getByRole('switch', { name: 'Sell gift cards' })).toBeChecked({ timeout: 15_000 })
    await page.screenshot({ path: 'test-results/gift-cards-settings-on-dark.png', fullPage: true })
  })
})
