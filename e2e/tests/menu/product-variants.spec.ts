/**
 * E2E — Variantes de producto (bloque 2 del dashboard). Las 3 pruebas obligatorias del repo y dos flujos de negocio:
 *   1. La lista cambia SIN recargar después de crear un producto con variantes.
 *   2. El buscador de Productos conserva foco y valor mientras la lista se vuelve a pintar.
 *   3. Biblioteca de opciones: cargando ≠ vacío ≠ error (con «Reintentar»).
 *   4. Plan Gratis: la casilla «Tiene variantes» sale apagada con la etiqueta Pro; en una familia existente los datos compartidos
 *      se ven deshabilitados y el precio de cada variante sigue editable.
 *   5. Agrupar productos que ya existen: «Confirmar» manda EXACTAMENTE el body de la vista previa + su huella.
 *
 * Todo `/api/v1/**` va simulado (LIFO: el catch-all de setupApiMocks primero, lo específico después). `GET /products` lee un estado
 * en memoria para que lo creado o agrupado aparezca como lo devolvería el server.
 */

import { test, expect, type Page, type Route } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { StaffRole, createMockVenue } from '../../fixtures/mock-data'
import { setupInventoryRecommendationsMocks, setupProductTypeMocks } from '../../fixtures/class-session-mocks'

test.setTimeout(60_000)
test.use({ viewport: { width: 1280, height: 900 } })

const VENUE = createMockVenue({
  id: 'venue-alpha',
  name: 'Tienda Alpha',
  slug: 'venue-alpha',
  type: 'RETAIL_STORE',
  permissions: ['menu:read', 'menu:create', 'menu:update', 'menu:delete', 'teams:read', 'settings:read', 'reports:read'],
})
const PRO = { hasPlan: true, state: 'active', planTier: 'PRO', grandfathered: false } as const
const GRATIS = { planTier: 'GRATIS', grandfathered: false } as const
const PRODUCTOS = '/venues/venue-alpha/menumaker/products'
const CATEGORIA = { id: 'cat-ropa', name: 'Ropa' }

// ─── Datos ──────────────────────────────────────────────────────

type Producto = Record<string, any>

function producto(o: Producto): Producto {
  return {
    venueId: 'venue-alpha',
    description: null,
    gtin: null,
    cost: null,
    type: 'REGULAR',
    active: true,
    imageUrl: null,
    categoryId: CATEGORIA.id,
    category: CATEGORIA,
    trackInventory: false,
    inventoryMethod: null,
    modifierGroups: [],
    menus: [],
    productGroupId: null,
    productGroupName: null,
    productGroupImageUrl: null,
    variantOptions: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...o,
  }
}

/** Una variante como la manda el server en la lista: es un producto con su familia y sus valores. */
function variante(groupId: string, padre: string, opciones: string[], valores: string[], o: Producto): Producto {
  return producto({
    name: [padre, ...valores].join(' · '),
    productGroupId: groupId,
    productGroupName: padre,
    variantOptions: valores.map((value, i) => ({ name: opciones[i], value, namePosition: i, valuePosition: o.valuePosition ?? 0 })),
    ...o,
  })
}

const playera = () => [
  variante('grp-playera', 'Playera básica', ['Talla'], ['S'], { id: 'p-pl-s', sku: 'PL-S', price: 199, valuePosition: 0 }),
  variante('grp-playera', 'Playera básica', ['Talla'], ['M'], { id: 'p-pl-m', sku: 'PL-M', price: 199, valuePosition: 1 }),
]

/** El detalle de una familia (GET /product-groups/:id), armado con sus variantes del estado. */
function detalle(productos: Producto[], groupId: string) {
  const vs = productos.filter(p => p.productGroupId === groupId)
  const nombres = (vs[0]?.variantOptions ?? []).map((o: any) => o.name as string)
  return {
    id: groupId,
    name: vs[0]?.productGroupName ?? '',
    description: null,
    imageUrl: null,
    categoryId: CATEGORIA.id,
    type: 'REGULAR',
    ivaTratamiento: 'IVA_16',
    satProductKey: null,
    satUnitKey: null,
    printStationId: null,
    source: 'MANUAL',
    modifierGroupIds: [],
    options: nombres.map((name: string, i: number) => ({
      id: `opt-${i}`,
      name,
      position: i,
      values: [...new Set(vs.map(v => v.variantOptions[i].value as string))].map((value, j) => ({ id: `val-${i}-${j}`, value, position: j })),
    })),
    variants: vs.map(v => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
      gtin: null,
      price: v.price,
      cost: null,
      active: true,
      variantImageUrl: null,
      values: v.variantOptions.map((o: any) => o.value),
      stock: null,
    })),
    archivedCount: 0,
    archived: false,
    archivedAt: null,
  }
}

// ─── Simulación del server ──────────────────────────────────────

interface Server {
  productos: Producto[]
  creaciones: any[]
  vistasPrevias: any[]
  agrupaciones: any[]
}

const ok = (route: Route, data: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
const paginado = (items: unknown[] = [], pageSize = 25) => ({ items, total: items.length, page: 1, pageSize })
const ruta = (sufijo: RegExp) => (url: URL) => url.pathname.startsWith('/api/v1/dashboard/venues/') && sufijo.test(url.pathname)

async function montar(page: Page, planState: Record<string, unknown>, productos: Producto[]): Promise<Server> {
  const server: Server = { productos, creaciones: [], vistasPrevias: [], agrupaciones: [] }

  await page.addInitScript(() => {
    localStorage.setItem('lang', 'es')
    const style = document.createElement('style')
    style.textContent = '.tsqd-parent-container { display: none !important; }'
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style))
  })

  await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [VENUE], planState })
  await setupProductTypeMocks(page, { includeClass: false, venueType: 'RETAIL_STORE' })
  await setupInventoryRecommendationsMocks(page)

  const lista = (body: unknown) => (route: Route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  await page.route(ruta(/\/menucategories$/), lista([{ ...CATEGORIA, displayOrder: 0, active: true }]))
  await page.route(ruta(/\/modifier-groups$/), lista([]))
  await page.route(ruta(/\/products$/), route => ok(route, server.productos))

  // Familias: lista, sugerencias, detalle y alta.
  await page.route(ruta(/\/product-groups(\/suggestions)?$/), route => {
    if (route.request().method() !== 'POST') return ok(route, paginado([], 20))
    const body = route.request().postDataJSON()
    server.creaciones.push(body)
    const nombres = body.options.map((o: any) => o.name)
    const nuevas = body.variants.map((v: any, i: number) =>
      variante('grp-nueva', body.name, nombres, v.values, { id: `p-nueva-${i}`, sku: `AUTO-${i}`, price: v.price, valuePosition: i }),
    )
    server.productos = [...server.productos, ...nuevas]
    return ok(route, { groupId: 'grp-nueva', productIds: nuevas.map((p: Producto) => p.id), categoryId: body.categoryId }, 201)
  })
  await page.route(ruta(/\/product-groups\/[^/]+$/), route => {
    const groupId = new URL(route.request().url()).pathname.split('/').pop()!
    if (groupId === 'suggestions') return ok(route, paginado([], 20))
    return ok(route, detalle(server.productos, groupId))
  })

  // Agrupar existentes: vista previa (huella 'h1') y confirmación.
  await page.route(ruta(/\/product-groups\/group-existing\/preview$/), route => {
    const body = route.request().postDataJSON()
    server.vistasPrevias.push(body)
    const porId = new Map(server.productos.map(p => [p.id, p]))
    return ok(route, {
      parent: {
        name: body.name,
        categoryId: CATEGORIA.id,
        type: 'REGULAR',
        ivaTratamiento: 'IVA_16',
        description: null,
        imageUrl: null,
        printStationId: null,
        satProductKey: null,
        satUnitKey: null,
        modifierGroupIds: [],
      },
      options: body.options,
      members: body.members.map((m: any) => ({
        productId: m.productId,
        sku: porId.get(m.productId)?.sku ?? '',
        currentName: porId.get(m.productId)?.name ?? '',
        newName: [body.name, ...m.values].join(' · '),
        values: m.values,
        changes: [],
      })),
      warnings: [],
      fingerprint: 'h1',
      firstMemberIva: 'IVA_16',
    })
  })
  await page.route(ruta(/\/product-groups\/group-existing$/), route => {
    const body = route.request().postDataJSON()
    server.agrupaciones.push(body)
    const nombres = body.options.map((o: any) => o.name)
    server.productos = server.productos.map(p => {
      const m = body.members.find((x: any) => x.productId === p.id)
      if (!m) return p
      const i = body.members.indexOf(m)
      return variante('grp-agrupada', body.name, nombres, m.values, { id: p.id, sku: p.sku, price: p.price, valuePosition: i })
    })
    return ok(route, { groupId: 'grp-agrupada', productIds: body.members.map((m: any) => m.productId), categoryId: CATEGORIA.id }, 201)
  })

  return server
}

async function abrirProductos(page: Page) {
  await page.goto(PRODUCTOS)
  await expect(page.getByRole('button', { name: 'Nuevo producto' })).toBeVisible({ timeout: 20_000 })
}

/** «Nuevo producto» → «Artículo Regular» → «Siguiente» → el asistente. */
async function abrirAsistente(page: Page) {
  await page.getByRole('button', { name: 'Nuevo producto' }).click()
  await page.getByRole('button', { name: /Artículo Regular/i }).click()
  await page.getByRole('button', { name: /Siguiente/i }).click()
  await expect(page.locator('input#name')).toBeVisible({ timeout: 10_000 })
}

/** La fila de un producto suelto en la tabla de Productos. */
const filaDe = (page: Page, nombre: string) => page.getByRole('row').filter({ has: page.getByRole('cell', { name: nombre, exact: true }) })
/** La fila de una familia: la que trae su flecha (las variantes desplegadas van en filas aparte, debajo). */
const filaDeFamilia = (page: Page, nombre: string) =>
  page.getByRole('row').filter({ has: page.getByRole('button', { name: `Ver variantes de ${nombre}`, exact: true }) })

// ─── Pruebas ────────────────────────────────────────────────────

test.describe('Variantes de producto', () => {
  test('1 · crear «Playera básica» con tallas S y M: el body es el del contrato y la lista la muestra sin recargar', async ({ page }) => {
    const server = await montar(page, PRO, [producto({ id: 'p-gorra', name: 'Gorra', sku: 'GO-1', price: 150 })])
    await abrirProductos(page)
    let recargas = 0
    page.on('framenavigated', f => {
      if (f === page.mainFrame()) recargas++
    })

    await abrirAsistente(page)
    await page.locator('input#name').fill('Playera básica')
    await page.locator('[data-tour="product-wizard-category"] input').click()
    await page.getByRole('option', { name: 'Ropa' }).click()

    const casilla = page.locator('#producto-con-variantes')
    await expect(casilla).toBeEnabled()
    await casilla.click()
    await page.getByLabel('Nombre de la opción', { exact: true }).fill('Talla')
    const valores = page.getByLabel('Valores de la opción', { exact: true })
    await valores.click()
    await valores.pressSequentially('S')
    await valores.press('Enter')
    await valores.pressSequentially('M')
    await valores.press('Enter')
    await expect(page.getByText('Se crearán 2 de 2 variantes')).toBeVisible()

    await page.getByLabel('Precio para todas las variantes', { exact: true }).fill('199')
    await page.getByRole('button', { name: 'Aplicar a todas' }).click()
    await expect(page.getByLabel('Precio de Playera básica · S', { exact: true })).toHaveValue('199')
    await page.locator('[data-tour="product-wizard-finish"]').click()

    await expect.poll(() => server.creaciones.length, { timeout: 10_000 }).toBe(1)
    const body = server.creaciones[0]
    expect(body).toMatchObject({ name: 'Playera básica', categoryId: CATEGORIA.id, options: [{ name: 'Talla', values: ['S', 'M'] }] })
    expect(body.variants).toEqual([
      { values: ['S'], price: 199 },
      { values: ['M'], price: 199 },
    ])
    for (const v of body.variants) expect(v).not.toHaveProperty('sku')
    expect(body).not.toHaveProperty('price')

    // Sin page.reload(): la lista se vuelve a pedir sola y la familia sale en UNA fila.
    await expect(page.locator('input#name')).toBeHidden({ timeout: 10_000 })
    const fila = filaDeFamilia(page, 'Playera básica')
    await expect(fila).toBeVisible({ timeout: 10_000 })
    await expect(fila).toContainText('2 variantes')
    await expect(filaDe(page, 'Gorra')).toBeVisible()
    expect(recargas).toBe(0)
  })

  test('2 · el buscador conserva foco y valor tecla por tecla, y la familia sale desplegada con su variante', async ({ page }) => {
    await montar(page, PRO, [producto({ id: 'p-gorra', name: 'Gorra', sku: 'GO-1', price: 150 }), ...playera()])
    await abrirProductos(page)
    await expect(filaDeFamilia(page, 'Playera básica')).toContainText('2 variantes')

    // La lupa del filtro de Productos (la del menú lateral es la búsqueda global); el botón no trae nombre accesible.
    await page.getByRole('main').locator('button:has(svg.lucide-search)').click()
    const buscador = page.getByPlaceholder('Buscar...')
    await expect(buscador).toBeFocused()

    let escrito = ''
    for (const tecla of 'PL-S') {
      await page.keyboard.type(tecla)
      escrito += tecla
      await page.waitForTimeout(450) // pasa el debounce de 300 ms: la lista se vuelve a pintar con lo escrito
      await expect(buscador).toBeFocused()
      await expect(buscador).toHaveValue(escrito)
    }

    const fila = filaDeFamilia(page, 'Playera básica')
    await expect(fila).toContainText('1 variante')
    await expect(fila.getByRole('button', { name: 'Ver variantes de Playera básica' })).toHaveAttribute('aria-expanded', 'true')
    const variantes = page.locator('[data-tour="products-family-variants"]')
    await expect(variantes).toContainText('PL-S')
    await expect(variantes).not.toContainText('PL-M')
    await expect(filaDe(page, 'Gorra')).toHaveCount(0)
  })

  test('3 · biblioteca de opciones: cargando ≠ vacío ≠ error, y «Reintentar» trae la lista', async ({ page }) => {
    await montar(page, PRO, [])
    let modo: 'lento' | 'vacio' | 'error' | 'lista' = 'lento'
    let soltar: () => void = () => {}
    const espera = new Promise<void>(r => (soltar = r))
    await page.route(ruta(/\/product-options$/), async route => {
      if (modo === 'lento') await espera
      if (modo === 'error') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'boom' }) })
      if (modo === 'lista')
        return ok(route, paginado([{ id: 'opt-talla', name: 'Talla', values: ['S', 'M', 'L'].map((value, i) => ({ id: `v${i}`, value, sortOrder: i })), valuesTotal: 3, valuesTruncated: false }]))
      return ok(route, paginado([]))
    })
    const cargando = page.getByTestId('biblioteca-cargando')
    const vacio = page.getByText('Todavía no tienes opciones guardadas. Crea «Talla», «Color» o «Tamaño» para reutilizarlas.')
    const error = page.getByText('No se pudieron cargar tus opciones guardadas.')
    const reintentar = page.getByRole('button', { name: 'Reintentar' })

    // Cargando: sólo el esqueleto, ni vacío ni error.
    await page.goto('/venues/venue-alpha/menumaker/product-options')
    await expect(cargando).toBeVisible({ timeout: 20_000 })
    await expect(vacio).toHaveCount(0)
    await expect(error).toHaveCount(0)

    // Vacío: llega una lista vacía.
    modo = 'vacio'
    soltar()
    await expect(vacio).toBeVisible()
    await expect(cargando).toHaveCount(0)
    await expect(error).toHaveCount(0)

    // Error: el server falla (también el reintento de la consulta) → texto de error + «Reintentar», nunca el texto de vacío.
    modo = 'error'
    await page.goto('/venues/venue-alpha/menumaker/product-options')
    await expect(error).toBeVisible({ timeout: 20_000 })
    await expect(reintentar).toBeVisible()
    await expect(vacio).toHaveCount(0)

    // «Reintentar» con el server ya bien: aparece la lista.
    modo = 'lista'
    await reintentar.click()
    await expect(page.getByText('S, M, L')).toBeVisible()
    await expect(page.getByText('1 opción')).toBeVisible()
    await expect(error).toHaveCount(0)
  })

  test('4 · en Gratis la casilla sale apagada con «Pro» y en la familia sólo el precio de cada variante se edita', async ({ page }) => {
    await montar(page, GRATIS, playera())
    await abrirProductos(page)

    await abrirAsistente(page)
    const casilla = page.locator('[data-tour="product-wizard-variants-toggle"]')
    await expect(casilla).toBeVisible()
    await expect(page.locator('#producto-con-variantes')).toBeDisabled()
    await expect(casilla).toContainText('Pro')
    await expect(casilla).toContainText('Disponible en Pro y Premium.')
    await page.getByRole('button', { name: 'Cancelar' }).click()
    await expect(page.locator('input#name')).toBeHidden()

    await filaDeFamilia(page, 'Playera básica').getByText('Playera básica', { exact: true }).click()
    const dialogo = page.locator('[data-tour="product-group-dialog"]')
    await expect(dialogo.locator('#familia-nombre')).toHaveValue('Playera básica', { timeout: 10_000 })
    await expect(dialogo).toContainText('necesitas el plan Pro')
    await expect(dialogo.locator('#familia-nombre')).toBeDisabled()
    await expect(dialogo.locator('#familia-descripcion')).toBeDisabled()
    await expect(dialogo.locator('#familia-categoria')).toBeDisabled()
    await expect(dialogo.getByLabel('Precio de Playera básica · S', { exact: true })).toBeEnabled()
    await expect(dialogo.getByLabel('Precio de Playera básica · M', { exact: true })).toBeEnabled()
  })

  test('5 · agrupar «Tenis - Talla 26» y «Tenis - Talla 27»: «Confirmar» manda el body de la vista previa + su huella', async ({ page }) => {
    const server = await montar(page, PRO, [
      producto({ id: 'p-26', name: 'Tenis - Talla 26', sku: 'TN-26', price: 899 }),
      producto({ id: 'p-27', name: 'Tenis - Talla 27', sku: 'TN-27', price: 899 }),
      producto({ id: 'p-gorra', name: 'Gorra', sku: 'GO-1', price: 150 }),
    ])
    await abrirProductos(page)

    await page.locator('[data-tour="products-variants-menu"]').click()
    await page.getByRole('menuitem', { name: 'Elegir productos para agrupar' }).click()
    await page.getByRole('checkbox', { name: 'Elegir Tenis - Talla 26' }).click()
    await page.getByRole('checkbox', { name: 'Elegir Tenis - Talla 27' }).click()
    await expect(page.locator('[data-tour="products-group-bar"]')).toContainText('2 elegidos')
    await page.locator('[data-tour="products-group-confirm"]').click()

    const dialogo = page.locator('[data-tour="group-existing-dialog"]')
    await expect(dialogo.locator('#agrupar-nombre')).toHaveValue('Tenis')
    await expect(dialogo.getByLabel('Opción 1', { exact: true })).toHaveValue('Talla')
    await expect(dialogo.getByLabel('Talla de Tenis - Talla 26', { exact: true })).toHaveValue('26')

    const confirmar = page.locator('[data-tour="group-existing-confirm"]')
    await expect(confirmar).toBeDisabled() // sin vista previa no se confirma
    await page.locator('[data-tour="group-existing-preview"]').click()
    await expect.poll(() => server.vistasPrevias.length).toBe(1)
    await expect(page.locator('[data-tour="group-existing-result"]')).toContainText('Tenis - Talla 26 → Tenis · 26')
    await expect(confirmar).toBeEnabled()
    // Cambiar algo después de la vista previa apaga «Confirmar»; volver a lo previsualizado lo prende otra vez.
    const valor27 = dialogo.getByLabel('Talla de Tenis - Talla 27', { exact: true })
    await valor27.fill('28')
    await expect(confirmar).toBeDisabled()
    await expect(page.locator('[data-tour="group-existing-result"]')).toContainText('Cambiaste algo después de la vista previa')
    await valor27.fill('27')
    await expect(confirmar).toBeEnabled()
    await confirmar.click()

    await expect.poll(() => server.agrupaciones.length).toBe(1)
    const vistaPrevia = server.vistasPrevias[0]
    expect(vistaPrevia).toEqual({
      name: 'Tenis',
      options: [{ name: 'Talla', values: ['26', '27'] }],
      members: [
        { productId: 'p-26', values: ['26'] },
        { productId: 'p-27', values: ['27'] },
      ],
    })
    expect(server.agrupaciones[0]).toEqual({ ...vistaPrevia, expectedFingerprint: 'h1' })

    // La familia nueva se abre y la lista ya la muestra en una fila.
    await expect(page.locator('[data-tour="product-group-dialog"] #familia-nombre')).toHaveValue('Tenis', { timeout: 10_000 })
  })
})
