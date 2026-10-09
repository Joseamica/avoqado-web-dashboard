/**
 * E2E — Configuración → «Mesas y plano» y su editor.
 *
 * Cubre las tres pruebas obligatorias de `.claude/rules/testing-and-git.md`: guardar y VER la página cambiada SIN
 * recargar (la prueba es la tarjeta del área, no el aviso), y que cargando / error / vacío se distinguen. Además: el
 * arrastre llega al PUT, el 409 avisa en vez de pisar, el 422 dice qué mesas tienen cuenta abierta y las regresa, Esc
 * suelta la herramienta antes de cerrar (y con el aviso «Plano guardado» a la vista basta UN Esc para salir), y los
 * candados (permiso, plan Pro, pantalla angosta).
 *
 * Las respuestas son fingidas (`page.route`): prueban el navegador, no el servidor.
 * 🔴 Con el editor abierto, la página sigue debajo con las miniaturas de cada área, que también dibujan
 * `floor-table-N`: las mesas del editor se buscan SIEMPRE dentro del lienzo (`mesaEnLienzo`).
 */
import { test, expect, type Page } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { StaffRole, createMockVenue } from '../../fixtures/mock-data'

test.setTimeout(60_000)
test.use({ viewport: { width: 1440, height: 900 } })

const PERMS = ['home:read', 'settings:read', 'tables:read', 'tables:configure']
const venue = (permissions = PERMS) => createMockVenue({ id: 'venue-alpha', name: 'Restaurante Alpha', slug: 'venue-alpha', permissions })
const PRO = { hasPlan: true, state: 'active', planTier: 'PRO', grandfathered: false } as const
const LIMITS = { areas: 30, tables: 500, elements: 1500 }

// Respuestas del servidor fingido: estructuras sueltas a propósito (el cuerpo del PUT también se lee como JSON libre).
type Plan = { fingerprint: string; areas: any[]; tables: any[]; elements: any[]; limits: typeof LIMITS; overLimit: boolean }
const emptyPlan = (): Plan => ({ fingerprint: '0000000000000000', areas: [], tables: [], elements: [], limits: LIMITS, overLimit: false })
const salon = (tables: any[]): Plan => ({
  ...emptyPlan(),
  fingerprint: 'aaaaaaaaaaaaaaaa',
  areas: [{ id: 'a1', name: 'Salón', floorShape: 'WIDE', sortOrder: 0, externalId: null }],
  tables,
})
const mesa = (id: string, number: string, extra: Record<string, unknown> = {}) => ({
  id,
  number,
  capacity: 4,
  shape: 'SQUARE',
  rotation: 0,
  positionX: 0.25,
  positionY: 0.4,
  areaId: 'a1',
  hasOpenOrder: false,
  ...extra,
})

/** Lo que devolvería el servidor tras publicar: los ids son las claves que mandó el editor. */
function echo(body: any): Plan {
  const id = (x: any) => x.id ?? x.clientId
  return {
    fingerprint: 'bbbbbbbbbbbbbbbb',
    limits: LIMITS,
    overLimit: false,
    areas: body.areas.map((a: any) => ({ id: id(a), name: a.name, floorShape: a.floorShape, sortOrder: a.sortOrder, externalId: null })),
    tables: body.tables.map((t: any) => ({
      id: id(t),
      number: t.number,
      capacity: t.capacity,
      shape: t.shape,
      rotation: t.rotation,
      positionX: t.positionX,
      positionY: t.positionY,
      areaId: t.areaRef,
      hasOpenOrder: false,
    })),
    elements: body.elements.map((e: any, i: number) => ({
      id: e.id ?? e.clientId ?? `e${i}`,
      type: e.type,
      areaId: e.areaRef,
      positionX: e.positionX,
      positionY: e.positionY,
      width: e.width ?? null,
      height: e.height ?? null,
      rotation: e.rotation,
      endX: e.endX ?? null,
      endY: e.endY ?? null,
      label: e.label ?? null,
      color: e.color ?? null,
    })),
  }
}

/**
 * Servidor fingido CON ESTADO: el GET devuelve lo último que se publicó.
 * `holdGet`: el GET espera a esta promesa (para ver el «cargando» sin carreras).
 */
async function mockFloorPlan(
  page: Page,
  initial: Plan,
  opts: { getStatus?: number; holdGet?: Promise<void>; put?: { status: number; body: unknown } } = {},
) {
  let plan = initial
  let getStatus = opts.getStatus ?? 200
  const puts: any[] = []
  await page.route('**/api/v1/dashboard/venues/*/onboarding-state', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { 'platform-welcome-completed': true } }) }),
  )
  await page.route('**/api/v1/dashboard/venues/*/floor-plan', async route => {
    if (route.request().method() === 'GET') {
      if (opts.holdGet) await opts.holdGet
      if (getStatus !== 200) return route.fulfill({ status: getStatus, contentType: 'application/json', body: JSON.stringify({ message: 'boom' }) })
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: plan }) })
    }
    const body = route.request().postDataJSON()
    puts.push(body)
    if (opts.put) return route.fulfill({ status: opts.put.status, contentType: 'application/json', body: JSON.stringify(opts.put.body) })
    plan = echo(body)
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { ...plan, publicationId: 'pub-1', replayed: false } }) })
  })
  return { puts, healGet: () => (getStatus = 200) }
}

async function closeTanStackDevTools(page: Page) {
  const close = page.locator('button[aria-label="Close tanstack query devtools"]')
  if (await close.isVisible().catch(() => false)) await close.click()
  await page.addStyleTag({ content: '.tsqd-parent-container{display:none!important}' })
}

async function abrir(page: Page) {
  await page.addInitScript(() => localStorage.setItem('lang', 'es'))
  await page.goto('/venues/venue-alpha/settings/floor-plan')
  await expect(page.getByRole('heading', { name: 'Mesas y plano' })).toBeVisible({ timeout: 15_000 })
  await closeTanStackDevTools(page)
}

async function abrirEditor(page: Page) {
  await page.getByTestId('floor-plan-edit-btn').click()
  await expect(page.getByTestId('floor-canvas')).toBeVisible()
  // El editor entra deslizándose (300 ms). Medir antes de que se asiente deja el ratón sobre el fondo del modal, y
  // tocar el fondo lo cierra: se espera a que el lienzo esté quieto (la comprobación «estable» de Playwright).
  await page.getByTestId('floor-canvas').hover({ trial: true })
}

const lienzo = (page: Page) => page.getByTestId('floor-canvas')
const mesaEnLienzo = (page: Page, number: string) => lienzo(page).getByTestId(`floor-table-${number}`)
const mesasEnLienzo = (page: Page) => lienzo(page).locator('[data-testid^="floor-table-"]')

test('vacío → arranque rápido → guardar → la tarjeta del área aparece sin recargar', async ({ page }) => {
  await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [venue()], planState: PRO })
  const { puts } = await mockFloorPlan(page, emptyPlan())
  await abrir(page)
  await expect(page.getByTestId('floor-plan-empty')).toBeVisible()
  await page.getByTestId('floor-plan-start').click()
  await page.getByTestId('new-area-name').fill('Salón')
  await page.getByTestId('new-area-count').fill('6')
  await page.getByTestId('new-area-create').click()
  await expect(mesasEnLienzo(page)).toHaveCount(6)
  await page.getByTestId('floor-plan-save').click()
  await expect.poll(() => puts.length).toBe(1)
  expect(puts[0].areas).toEqual([expect.objectContaining({ name: 'Salón', floorShape: 'WIDE' })])
  expect(puts[0].tables).toHaveLength(6)
  for (const t of puts[0].tables) {
    expect(t.areaRef).toBe(puts[0].areas[0].clientId)
    expect(t.positionX).toBeGreaterThan(0)
    expect(t.positionX).toBeLessThan(1)
  }
  // Ya guardado: sin cambios pendientes, Guardar se apaga.
  await expect(page.getByTestId('floor-plan-save')).toBeDisabled()
  // Decisión 15-D: con el aviso «Plano guardado» a la vista, UN Esc cierra el aviso y el editor (antes hacían falta dos).
  await expect(page.getByText(/Plano guardado/).first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(lienzo(page)).toHaveCount(0)
  // 🔴 la prueba: la página cambió SIN recargar
  await expect(page.getByTestId('floor-plan-area-Salón')).toContainText('6 mesas · 24 lugares')
  await expect(page.getByTestId('floor-plan-empty')).toHaveCount(0)
})

test('cargando, error y vacío se distinguen; Reintentar recupera', async ({ page }) => {
  await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [venue()], planState: PRO })
  let soltar!: () => void
  const holdGet = new Promise<void>(resolve => (soltar = resolve))
  const m = await mockFloorPlan(page, emptyPlan(), { getStatus: 500, holdGet })
  await abrir(page)
  // Mientras el servidor no contesta: el esqueleto, nunca «aún no dibujas tu salón» ni el error.
  await expect(page.getByTestId('floor-plan-loading')).toBeVisible()
  await expect(page.getByTestId('floor-plan-empty')).toHaveCount(0)
  await expect(page.getByTestId('floor-plan-error')).toHaveCount(0)
  soltar()
  // El servidor falla dos veces (la consulta de la página reintenta una vez, `retry: 1`, y el GET fingido siempre da 500
  // hasta `healGet`): sólo entonces se DICE, y no parece un salón vacío.
  await expect(page.getByTestId('floor-plan-error')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('floor-plan-empty')).toHaveCount(0)
  await expect(page.getByTestId('floor-plan-loading')).toHaveCount(0)
  m.healGet()
  await page.getByTestId('floor-plan-retry').click()
  await expect(page.getByTestId('floor-plan-empty')).toBeVisible()
  await expect(page.getByTestId('floor-plan-error')).toHaveCount(0)
})

test('arrastrar una mesa la mueve y se guarda su nueva posición', async ({ page }) => {
  await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [venue()], planState: PRO })
  const { puts } = await mockFloorPlan(page, salon([mesa('t1', '1')]))
  await abrir(page)
  await abrirEditor(page)
  const box = (await mesaEnLienzo(page, '1').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2, { steps: 8 })
  await page.mouse.up()
  // Se ve donde quedó, antes de guardar.
  await expect.poll(async () => (await mesaEnLienzo(page, '1').boundingBox())!.x).toBeGreaterThan(box.x + 100)
  await page.getByTestId('floor-plan-save').click()
  await expect.poll(() => puts.length).toBe(1)
  expect(puts[0].tables[0]).toMatchObject({ id: 't1', areaRef: 'a1' })
  expect(puts[0].tables[0].positionX).toBeGreaterThan(0.3)
  expect(puts[0].tables[0].positionY).toBeCloseTo(0.4, 1)
  // Cierra con su botón (testid propio: «Cerrar» por nombre choca con el del aviso que queda a la vista).
  await page.getByTestId('floor-editor-close').click()
  await expect(lienzo(page)).toHaveCount(0)
})

test('si alguien más cambió el plano, avisa en vez de pisarlo', async ({ page }) => {
  await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [venue()], planState: PRO })
  const { puts } = await mockFloorPlan(page, salon([mesa('t1', '1')]), {
    put: { status: 409, body: { message: 'Alguien más…', code: 'FLOOR_PLAN_CHANGED' } },
  })
  await abrir(page)
  await abrirEditor(page)
  await mesaEnLienzo(page, '1').click()
  await page.keyboard.press('r') // girar: el atajo del editor
  await page.getByTestId('floor-plan-save').click()
  await expect(page.getByText('Alguien más cambió el plano')).toBeVisible()
  await expect(page.getByTestId('floor-plan-reload')).toBeVisible()
  // Lo que se mandó llevaba la huella del plano que se abrió: así el servidor detecta el cambio ajeno.
  expect(puts[0].baseFingerprint).toBe('aaaaaaaaaaaaaaaa')
  expect(puts[0].tables[0]).toMatchObject({ id: 't1', rotation: 45 }) // la mesa gira de 45 en 45
})

test('una mesa con cuenta abierta no se puede quitar; el 422 se explica y «Regresar la mesa» la repone', async ({ page }) => {
  await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [venue()], planState: PRO })
  // Carrera: la 5 estaba libre al abrir el editor, pero un mesero le abrió cuenta antes de guardar.
  const { puts } = await mockFloorPlan(page, salon([mesa('t4', '4', { hasOpenOrder: true }), mesa('t5', '5', { positionX: 0.6 })]), {
    put: { status: 422, body: { message: 'x', code: 'TABLES_WITH_OPEN_ORDERS', details: { numbers: ['5'] } } },
  })
  await abrir(page)
  await abrirEditor(page)
  await mesaEnLienzo(page, '4').click()
  await expect(page.getByTestId('floor-inspector-remove')).toBeDisabled()
  // Supr tampoco quita la que tiene cuenta abierta.
  await page.keyboard.press('Delete')
  await expect(mesasEnLienzo(page)).toHaveCount(2)
  await mesaEnLienzo(page, '5').click()
  await page.keyboard.press('Delete')
  await expect(mesasEnLienzo(page)).toHaveCount(1)
  await page.getByTestId('floor-plan-save').click()
  await expect.poll(() => puts.length).toBe(1)
  expect(puts[0].tables.map((t: { id: string }) => t.id)).toEqual(['t4'])
  const aviso = page.getByTestId('floor-plan-open-orders')
  await expect(aviso).toContainText('La mesa 5 tiene una cuenta abierta')
  await page.getByTestId('floor-plan-restore-tables').click()
  await expect(aviso).toHaveCount(0)
  await expect(mesasEnLienzo(page)).toHaveCount(2)
  await expect(lienzo(page).getByTestId('floor-open-order-5')).toBeVisible()
})

test('Esc suelta la herramienta sin cerrar el editor; con nada activo, cierra', async ({ page }) => {
  await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [venue()], planState: PRO })
  await mockFloorPlan(page, salon([mesa('t1', '1')]))
  await abrir(page)
  await abrirEditor(page)
  await page.getByTestId('floor-tool-WALL').click()
  await expect(page.getByTestId('floor-tool-WALL')).toHaveAttribute('aria-pressed', 'true')
  const canvas = (await lienzo(page).boundingBox())!
  // Una esquina vacía (la mesa 1 está a 0.25 × 0.4): el clic no cae sobre una pieza.
  await page.mouse.click(canvas.x + canvas.width * 0.06, canvas.y + canvas.height * 0.08) // empieza una pared
  await page.keyboard.press('Escape')
  await expect(lienzo(page)).toBeVisible()
  await expect(page.getByTestId('floor-tool-WALL')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByText('¿Salir sin guardar?')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(lienzo(page)).toHaveCount(0)
  await expect(page.getByText('¿Salir sin guardar?')).toHaveCount(0)
})

test('sin «Configurar mesas y plano» el plano sólo se ve', async ({ page }) => {
  await setupApiMocks(page, { userRole: StaffRole.CASHIER, venues: [venue(['home:read', 'tables:read'])], planState: PRO })
  await mockFloorPlan(page, salon([mesa('t1', '1')]))
  await abrir(page)
  await expect(page.getByTestId('floor-plan-no-permission')).toBeVisible()
  await expect(page.getByTestId('floor-plan-area-Salón')).toBeVisible()
  await expect(page.getByTestId('floor-plan-edit-btn')).toHaveCount(0)
})

test('plan Gratis: se ve el candado de Pro y no se puede editar', async ({ page }) => {
  await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [venue()], planState: { planTier: 'GRATIS', grandfathered: false } as never })
  await mockFloorPlan(page, salon([mesa('t1', '1')]))
  await abrir(page)
  await expect(page.getByText('Incluido en Pro')).toBeVisible()
  await expect(page.getByTestId('floor-plan-edit-btn')).toHaveCount(0)
})

test.describe('pantalla angosta', () => {
  test.use({ viewport: { width: 900, height: 800 } })
  test('pide abrirlo en una computadora y no ofrece editar', async ({ page }) => {
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [venue()], planState: PRO })
    await mockFloorPlan(page, salon([mesa('t1', '1')]))
    await abrir(page)
    await expect(page.getByTestId('floor-plan-narrow')).toBeVisible()
    await expect(page.getByTestId('floor-plan-area-Salón')).toBeVisible()
    await expect(page.getByTestId('floor-plan-edit-btn')).toHaveCount(0)
  })
})
