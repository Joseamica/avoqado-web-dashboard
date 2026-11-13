/**
 * Pantalla del cliente (F1) — la tarjeta de Información, el editor «A» y copiar a otras cajas (aprobado el 14-oct-2026).
 * Respuestas con la forma real del contrato (avoqado-server `src/routes/dashboard/customerDisplay.routes.ts`).
 *
 * Las tres obligatorias de testing-and-git.md:
 *  1. escribir y VER el cambio sin recargar: guardar el diseño, un paso del cobro y copiar;
 *  2. teclear conserva el foco aunque la vista previa vaya al server en cada pausa;
 *  3. sin permiso, sólo lectura, CARGANDO, error y lista vacía se distinguen entre sí (y del camino feliz).
 * Y lo que pidió Codex (F1 r1): restablecer y ver el resultado, y una reconsulta fallida con el borrador abierto. Más lo
 * que cambiaron las rondas de arreglo: un guardado de respuesta perdida (aviso «No pudimos confirmar» o se da por hecho
 * si el server ya lo tiene), «Sin confirmar» en los pasos, el tope de 6 porcentajes y «Cargar más» bloqueado mientras carga.
 * Y lo del arreglo final (Codex F1 código): la RED de verdad en los pasos (la escritura se aplica, su respuesta se aborta y el
 * reintento automático de `src/api.ts` recibe 409/429), y un error de fondo de la PÁGINA del aparato con el editor abierto.
 */
import { test, expect, type Page, type Route } from '@playwright/test'

import { setupApiMocks } from '../../fixtures/api-mocks'
import { createMockVenue, StaffRole } from '../../fixtures/mock-data'
// Los textos que cambian con el tiempo se leen del JSON de la app (no se copian aquí): si se reescriben, la prueba los sigue.
import es from '../../../src/locales/es/customerDisplay.json' with { type: 'json' }

test.setTimeout(60_000)
test.use({ locale: 'es-MX' })

// 🔴 El id y el slug son DISTINTOS a propósito: la URL de la página lleva el slug y las llamadas al API llevan el id. Con el mismo
// valor en los dos, una llamada armada con el equivocado pasaría sin que nadie lo notara.
const VENUE_ID = 'venue-alpha-id'
const VENUE_SLUG = 'venue-alpha-slug'
const CAJA_1 = 'dev-caja-1'
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR
const PERMISOS_COMPLETOS = ['customer-display:read', 'customer-display:update', 'tpv-settings:read', 'tpv-settings:update']

type Diseno = {
  theme: 'LIGHT' | 'DARK'
  accentColor: string | null
  logoAssetId: string | null
  welcomeText: string | null
  thanksText: string | null
  slides: { assetId: string }[]
  slideSeconds: number
  showPromotions: boolean
}
const FABRICA: Diseno = {
  theme: 'LIGHT',
  accentColor: null,
  logoAssetId: null,
  welcomeText: null,
  thanksText: null,
  slides: [],
  slideSeconds: 8,
  showPromotions: false,
}
const PROPIO: Diseno = { ...FABRICA, theme: 'DARK', welcomeText: '¡Bienvenido a Testarudo!' }

const limpiar = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim() || null
function fichaDe(d: Diseno) {
  return {
    schemaVersion: 1,
    fingerprint: `fp:${d.theme}:${d.accentColor ?? '-'}:${limpiar(d.welcomeText) ?? '-'}:${limpiar(d.thanksText) ?? '-'}`,
    theme: d.theme,
    accent: d.accentColor ? { custom: true, color: d.accentColor.toUpperCase(), on: '#FFFFFF' } : { custom: false },
    logo: null,
    welcomeText: limpiar(d.welcomeText),
    thanksText: limpiar(d.thanksText),
    slides: [],
    slideSeconds: 8,
    promotionCards: { enabled: false },
    poweredBy: true,
  }
}
const siguienteToken = (t: string) => (t === 'factory' ? 'cdd-1:1' : `cdd-1:${Number(t.split(':')[1]) + 1}`)
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
const ERROR_500 = { message: 'Ocurrió un error inesperado en el servidor.' }

/** Las rutas del API de ESTA pantalla, con el id del negocio (nunca el slug): un id y un slug mezclados dejan de coincidir. */
const rutaDeVenue = (resto: string) => `/api/v1/dashboard/venues/${VENUE_ID}/${resto}`
const rutaDeLaPantalla = (sufijo = '') => rutaDeVenue(`terminals/${CAJA_1}/customer-display${sufijo}`)
const RUTA_DE_LOS_PASOS = `/api/v1/dashboard/tpv/${CAJA_1}/settings`

const escapar = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const exacta = (metodo: string, ruta: string) => new RegExp(`^${metodo} ${escapar(ruta)}$`)

/**
 * 🔴 Guardia de llamadas inesperadas. `setupApiMocks` contesta `{}` a CUALQUIER ruta del API que nadie fingió, y eso deja
 * pasar en silencio una llamada armada con el id equivocado, un endpoint que no debía tocarse o una escritura que nadie
 * pidió. Aquí se apuntan todas las peticiones a `/api/v1/` y las que no están en esta lista cuentan como inesperadas; cada
 * prueba termina exigiendo que no haya ninguna (`afterEach`).
 */
const PETICIONES_DE_LA_PAGINA = [
  // Sesión y menú lateral (los fingidos de `setupApiMocks`)…
  exacta('GET', '/api/v1/dashboard/auth/status'),
  exacta('GET', '/api/v1/me/access'),
  exacta('GET', rutaDeVenue('plan-tier')),
  exacta('GET', rutaDeVenue('features')),
  exacta('GET', rutaDeVenue('role-config')),
  exacta('GET', rutaDeVenue('onboarding-state')),
  // …y los que el comodín contesta `{}` y la página tolera (campanita, avisos, organización, suplantación).
  exacta('GET', '/api/v1/dashboard/notifications'),
  exacta('GET', '/api/v1/dashboard/announcements/home'),
  exacta('GET', '/api/v1/dashboard/impersonation/status'),
  exacta('GET', '/api/v1/organizations/org-test-001/venues'),
  exacta('GET', '/api/v1/organizations/org-test-001/stats'),
]
const PERMITIDAS = [
  // Lo que esta suite finge a propósito (con el id del negocio, no el slug).
  exacta('GET', rutaDeVenue(`tpv/${CAJA_1}`)),
  exacta('GET', rutaDeLaPantalla()),
  exacta('PUT', rutaDeLaPantalla()),
  exacta('POST', rutaDeLaPantalla('/reset')),
  exacta('POST', rutaDeLaPantalla('/preview')),
  exacta('POST', rutaDeLaPantalla('/copy')),
  exacta('GET', rutaDeVenue('customer-display/devices')),
  exacta('GET', RUTA_DE_LOS_PASOS),
  exacta('PUT', RUTA_DE_LOS_PASOS),
  // Lo que la página del dispositivo pide por su cuenta y `setupApiMocks` ya responde (o contesta vacío a propósito).
  ...PETICIONES_DE_LA_PAGINA,
]

/**
 * Qué hace el server con cada PUT del diseño, en orden (el resto responde 'ok'):
 *  - 'conflicto': alguien más ya guardó (409 del contrato, con su mensaje);
 *  - 'perdido': un 500 SIN haber aplicado nada (la respuesta se perdió y el cambio nunca llegó);
 *  - 'aplicado-sin-respuesta': guarda de verdad y contesta 500 (la respuesta se perdió pero el cambio SÍ quedó).
 */
type ModoDeGuardado = 'ok' | 'conflicto' | 'perdido' | 'aplicado-sin-respuesta'
/**
 * Qué hace el server con el PUT de los pasos del cobro, y con la relectura que le sigue:
 *  - '5xx': contesta 500 SIN aplicar nada (un 5xx no prueba nada: se relee);
 *  - '5xx-y-no-relee': lo mismo, y la relectura también falla;
 *  - 'aplicado-sin-red': el PRIMER PUT se aplica y su respuesta se pierde en la RED (`route.abort('failed')`); el reintento
 *    automático de `src/api.ts` (1 s después) recibe `respuestaDelReintento` (409 o 429), que tampoco prueba nada.
 */
type ModoDePasos = 'ok' | '5xx' | '5xx-y-no-relee' | 'aplicado-sin-red'

interface Escenario {
  permisos?: string[]
  diseno?: Diseno
  editToken?: string
  fallasDeLaVista?: number
  /** Espera de la PRIMERA lectura del diseño (la de la tarjeta): para ver el «cargando» sin confundirlo con vacío o error. */
  demoraDeLaVista?: number
  /** Espera de la PRIMERA página de destinos (al abrir «Copiar»): lo mismo, para la lista. */
  demoraDeDestinos?: number
  guardados?: ModoDeGuardado[]
  destinos?: 'dos-paginas' | 'vacia' | 'error'
  demoraDeVistaPrevia?: number
  /** Espera de la SEGUNDA página de destinos («Cargar más»), para ver el botón bloqueado mientras carga. */
  demoraDeLaSegundaPagina?: number
  pasos?: ModoDePasos
  /** Espera de la relectura de los pasos que sigue a un guardado incierto (para ver «Sin confirmar»). */
  demoraDeLaRelecturaDePasos?: number
  /** Con `pasos: 'aplicado-sin-red'`: lo que recibe el reintento automático. */
  respuestaDelReintento?: 409 | 429
  tipSuggestions?: number[]
  /** Cuántas RELECTURAS del detalle del aparato (`GET .../tpv/:id`, la consulta de la página) fallan con 500. La primera nunca. */
  fallasDelAparato?: number
}

/** El escenario de la prueba en curso: el `afterEach` de abajo le exige cero llamadas inesperadas. */
let estadoActual: { inesperadas: string[] } | null = null
test.beforeEach(() => {
  estadoActual = null
})
test.afterEach(() => {
  expect(estadoActual?.inesperadas ?? [], 'llamadas a /api/v1/ que la suite no finge (las atrapó el comodín de setupApiMocks)').toEqual([])
})

async function preparar(page: Page, esc: Escenario = {}) {
  const venue = createMockVenue({ id: VENUE_ID, name: 'Testarudo Cafe', slug: VENUE_SLUG })
  venue.permissions = [
    ...venue.permissions.filter(p => !p.startsWith('customer-display') && !p.startsWith('tpv-settings')),
    ...(esc.permisos ?? PERMISOS_COMPLETOS),
  ]
  // El panel de React Query Devtools (sólo en `npm run dev`) tapa los botones de abajo.
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style')
      style.textContent = '.tsqd-parent-container{display:none!important}'
      document.head.appendChild(style)
    })
  })
  await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [venue] })

  const estado = {
    diseno: esc.diseno ?? FABRICA,
    editToken: esc.editToken ?? 'factory',
    ajustes: {
      showTipScreen: true,
      showReviewScreen: true,
      showReceiptScreen: true,
      tipSuggestions: esc.tipSuggestions ?? [10, 15, 20],
      defaultTipPercentage: null as number | null,
    },
    tokensDeDestino: { 'dev-barra': 'factory', 'dev-caja-2': 'factory', 'dev-mostrador': 'factory' } as Record<string, string>,
    llamadasALaVista: 0,
    llamadasADestinos: 0,
    llamadasAlAparato: 0,
    fallasDelAparato: esc.fallasDelAparato ?? 0,
    fallasDeLaVista: esc.fallasDeLaVista ?? 0,
    modosDeGuardado: [...(esc.guardados ?? [])],
    guardados: [] as Array<{ expectedEditToken: string; design: Partial<Diseno> }>,
    intentosDeAjustes: 0,
    cambiosDeAjustes: [] as Array<Record<string, unknown>>,
    copias: [] as Array<{
      source: { terminalId: string; editToken: string }
      targets: Array<{ terminalId: string; editToken: string }>
    }>,
    restablecimientos: [] as string[],
    /** Todas las peticiones a `/api/v1/` ("MÉTODO /ruta"), en orden. */
    peticiones: [] as string[],
    /** Las que no están en `PERMITIDAS`: `setupApiMocks` les contestaría `{}` sin avisar. */
    get inesperadas() {
      return this.peticiones.filter(p => !PERMITIDAS.some(permitida => permitida.test(p)))
    },
  }
  page.on('request', req => {
    const { pathname } = new URL(req.url())
    if (pathname.startsWith('/api/v1/')) estado.peticiones.push(`${req.method()} ${pathname}`)
  })
  estadoActual = estado
  const vista = () => ({
    data: {
      terminal: { id: CAJA_1, name: 'Caja 1' },
      editToken: estado.editToken,
      design: estado.diseno,
      ficha: fichaDe(estado.diseno),
      entitlements: { slides: false, promotionCards: false },
      assetRejected: [],
      device: {
        presence: 'SUPPORTED',
        stale: false,
        capabilitiesObservedAt: '2026-10-14T16:00:00.000Z',
        lastHeartbeat: new Date(Date.now() - 60_000).toISOString(),
        designVersion: 1,
        ack: null,
        installationWarning: false,
      },
    },
  })

  // El detalle del dispositivo (`GET .../tpv/:id`): una caja POS_ANDROID con segunda pantalla.
  await page.route(`**${rutaDeVenue(`tpv/${CAJA_1}`)}`, route => {
    if (route.request().method() !== 'GET') return route.fallback()
    estado.llamadasAlAparato += 1
    if (estado.llamadasAlAparato > 1 && estado.fallasDelAparato > 0) {
      estado.fallasDelAparato -= 1
      return json(route, ERROR_500, 500)
    }
    return json(route, {
      id: CAJA_1,
      name: 'Caja 1',
      serialNumber: null,
      type: 'POS_ANDROID',
      status: 'ACTIVE',
      venueId: VENUE_ID,
      lastHeartbeat: new Date().toISOString(),
      brand: 'SUNMI',
      model: 'Sunmi D3',
      version: '2.24.0',
      systemInfo: { osVersion: 'Android 11', batteryLevel: 90 },
      activatedAt: null,
      isLocked: false,
      selfRegistered: true,
      customerDisplayInverted: false,
      customerDisplayRequest: null,
      capabilities: {
        requiresActivation: false,
        canManagePaymentConfiguration: false,
        canAcceptTerminalPaymentRequests: false,
        customerDisplay: {
          presence: 'SUPPORTED',
          invertibility: 'UNSUPPORTED',
          canRequestInversion: false,
          observedAt: '2026-10-14T16:00:00.000Z',
          stale: false,
        },
        supportedRemoteCommands: [],
      },
    })
  })

  await page.route(
    url => url.pathname === rutaDeLaPantalla(),
    async route => {
      const req = route.request()
      if (req.method() === 'GET') {
        estado.llamadasALaVista += 1
        if (estado.llamadasALaVista === 1 && esc.demoraDeLaVista) await new Promise(r => setTimeout(r, esc.demoraDeLaVista))
        if (estado.fallasDeLaVista > 0) {
          estado.fallasDeLaVista -= 1
          return json(route, ERROR_500, 500)
        }
        return json(route, vista())
      }
      if (req.method() === 'PUT') {
        const cuerpo = req.postDataJSON() as { expectedEditToken: string; design: Partial<Diseno> }
        estado.guardados.push(cuerpo)
        const modo = estado.modosDeGuardado.shift() ?? 'ok'
        if (modo === 'conflicto') {
          estado.diseno = { ...estado.diseno, welcomeText: 'Texto de otra persona' }
          estado.editToken = siguienteToken(estado.editToken)
          return json(
            route,
            {
              message: 'Alguien más guardó este diseño mientras lo editabas.',
              code: 'CUSTOMER_DISPLAY_CONFLICT',
              details: { updatedById: 'staff-2' },
            },
            409,
          )
        }
        if (modo === 'perdido') return json(route, ERROR_500, 500)
        estado.diseno = {
          ...estado.diseno,
          ...cuerpo.design,
          welcomeText: limpiar(cuerpo.design.welcomeText),
          thanksText: limpiar(cuerpo.design.thanksText),
        }
        estado.editToken = siguienteToken(estado.editToken)
        if (modo === 'aplicado-sin-respuesta') return json(route, ERROR_500, 500)
        return json(route, {
          data: { editToken: estado.editToken, design: estado.diseno, ficha: fichaDe(estado.diseno), assetRejected: [] },
        })
      }
      return route.fallback()
    },
  )

  await page.route(
    url => url.pathname === rutaDeLaPantalla('/reset'),
    async route => {
      const { expectedEditToken } = route.request().postDataJSON() as { expectedEditToken: string }
      estado.restablecimientos.push(expectedEditToken)
      estado.diseno = FABRICA
      estado.editToken = siguienteToken(estado.editToken)
      return json(route, { data: { editToken: estado.editToken, design: estado.diseno, ficha: fichaDe(estado.diseno) } })
    },
  )

  await page.route(
    url => url.pathname === rutaDeLaPantalla('/preview'),
    async route => {
      const { design, previewSeq } = route.request().postDataJSON() as { design: Partial<Diseno>; previewSeq: number }
      if (esc.demoraDeVistaPrevia) await new Promise(r => setTimeout(r, esc.demoraDeVistaPrevia))
      return json(route, { data: { ficha: fichaDe({ ...estado.diseno, ...design }), assetRejected: [], previewSeq } })
    },
  )

  // Los pasos del cobro (`tpv-settings`): el GET devuelve los ajustes planos; el PUT mezcla sólo las llaves que llegan.
  await page.route(
    url => url.pathname === RUTA_DE_LOS_PASOS,
    async route => {
      const req = route.request()
      if (req.method() === 'PUT') {
        const cambio = req.postDataJSON() as Record<string, unknown>
        estado.intentosDeAjustes += 1
        estado.cambiosDeAjustes.push(cambio)
        if (esc.pasos === '5xx' || esc.pasos === '5xx-y-no-relee') return json(route, ERROR_500, 500)
        if (esc.pasos === 'aplicado-sin-red') {
          if (estado.intentosDeAjustes === 1) {
            Object.assign(estado.ajustes, cambio) // se APLICA…
            return route.abort('failed') // …y su respuesta se pierde en la red
          }
          const status = esc.respuestaDelReintento ?? 409
          return json(
            route,
            status === 429 ? { message: 'Demasiadas solicitudes. Intenta de nuevo en un momento.' } : { message: 'Otro cambio se cruzó.' },
            status,
          )
        }
        Object.assign(estado.ajustes, cambio)
        return json(route, estado.ajustes)
      }
      // Tras un guardado incierto, la relectura: lenta (para ver «Sin confirmar») o caída (para ver que el error sale pronto).
      if (estado.intentosDeAjustes > 0) {
        if (esc.demoraDeLaRelecturaDePasos) await new Promise(r => setTimeout(r, esc.demoraDeLaRelecturaDePasos))
        if (esc.pasos === '5xx-y-no-relee') return json(route, ERROR_500, 500)
      }
      return json(route, estado.ajustes)
    },
  )

  const fila = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
    id,
    name,
    editToken: id === CAJA_1 ? estado.editToken : estado.tokensDeDestino[id],
    designVersion: 1,
    presence: 'SUPPORTED',
    stale: false,
    capabilitiesObservedAt: '2026-10-14T16:00:00.000Z',
    lastHeartbeat: new Date().toISOString(),
    ...extra,
  })
  await page.route(
    url => url.pathname === rutaDeVenue('customer-display/devices'),
    async route => {
      estado.llamadasADestinos += 1
      if (estado.llamadasADestinos === 1 && esc.demoraDeDestinos) await new Promise(r => setTimeout(r, esc.demoraDeDestinos))
      if (esc.destinos === 'error') return json(route, ERROR_500, 500)
      if (esc.destinos === 'vacia') return json(route, { data: { total: 1, nextCursor: null, devices: [fila(CAJA_1, 'Caja 1')] } })
      const cursor = new URL(route.request().url()).searchParams.get('cursor')
      if (cursor && esc.demoraDeLaSegundaPagina) await new Promise(r => setTimeout(r, esc.demoraDeLaSegundaPagina))
      // Orden del server: nombre, id. Página de 2 para probar «Cargar más» (el cliente pide 50; el server decide).
      const todas = [
        fila('dev-barra', 'Barra'),
        fila(CAJA_1, 'Caja 1'),
        fila('dev-caja-2', 'Caja 2'),
        fila('dev-mostrador', 'Mostrador', { designVersion: null, presence: 'UNKNOWN', stale: true }),
      ]
      const pagina = cursor ? todas.slice(2) : todas.slice(0, 2)
      return json(route, { data: { total: todas.length, nextCursor: cursor ? null : CAJA_1, devices: pagina } })
    },
  )

  await page.route(
    url => url.pathname === rutaDeLaPantalla('/copy'),
    async route => {
      const cuerpo = route.request().postDataJSON() as (typeof estado.copias)[number]
      estado.copias.push(cuerpo)
      for (const destino of cuerpo.targets) estado.tokensDeDestino[destino.terminalId] = 'cdd-9:1'
      return json(route, { data: { copied: cuerpo.targets.map(d => d.terminalId), promosOmitted: true } })
    },
  )

  return estado
}

async function abrirDetalle(page: Page, esperarTarjeta = true) {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`/venues/${VENUE_SLUG}/devices/${CAJA_1}`)
  if (esperarTarjeta) await expect(page.getByTestId('customer-display-card')).toBeVisible({ timeout: 15_000 })
}
const abrirEditor = async (page: Page) => {
  await page.getByTestId('customer-display-card').getByRole('button', { name: 'Editar pantalla' }).click()
  return page.getByRole('dialog', { name: 'Pantalla del cliente · Caja 1' })
}
/** La sección «Pasos del cobro» (su `data-tour` es estable por regla). */
const pasosDelCobro = (page: Page) => page.locator('[data-tour="customer-display-steps"]')

test.describe('Pantalla del cliente — escribir y ver el cambio', () => {
  test('guardar el diseño cambia la tarjeta SIN recargar y manda sólo los cinco campos con el token leído', async ({ page }) => {
    const estado = await preparar(page)
    await abrirDetalle(page)
    const tarjeta = page.getByTestId('customer-display-card')
    await expect(tarjeta).toContainText('Diseño de fábrica')
    const editor = await abrirEditor(page)
    await expect(editor.getByRole('button', { name: 'Guardar' })).toBeDisabled()
    await editor.getByLabel('Al llegar').fill('¡Hola, bienvenido!')
    await editor.getByRole('button', { name: 'Oscuro' }).click()
    await expect(editor.getByTestId('tablet-preview')).toContainText('¡Hola, bienvenido!')
    await expect(editor.getByTestId('tablet-preview')).toHaveAttribute('data-tema', 'DARK')
    await editor.getByRole('button', { name: 'Guardar' }).click()
    await expect(editor).toBeHidden()
    expect(estado.guardados).toEqual([
      {
        expectedEditToken: 'factory',
        design: { theme: 'DARK', accentColor: null, logoAssetId: null, welcomeText: '¡Hola, bienvenido!', thanksText: '' },
      },
    ])
    // 🔴 La prueba es la tarjeta, no el aviso:
    await expect(tarjeta).toContainText('Diseño propio')
    await expect(tarjeta.getByTestId('tablet-preview')).toContainText('¡Hola, bienvenido!')
    await expect(tarjeta.getByTestId('tablet-preview')).toHaveAttribute('data-tema', 'DARK')
  })

  test('apagar «Pedir propina» guarda sólo esa llave, el interruptor se queda apagado y el editor ya no ofrece «Propina»', async ({
    page,
  }) => {
    const estado = await preparar(page)
    await abrirDetalle(page)
    const propina = page.getByRole('switch', { name: 'Pedir propina' })
    await expect(propina).toHaveAttribute('aria-checked', 'true')
    await propina.click()
    await expect.poll(() => estado.cambiosDeAjustes).toEqual([{ showTipScreen: false }])
    await expect(propina).toHaveAttribute('aria-checked', 'false')
    const editor = await abrirEditor(page)
    const momentos = editor.getByRole('group', { name: 'Momento del cobro' })
    await expect(momentos.getByRole('button', { name: 'Carrito' })).toBeVisible()
    await expect(momentos.getByRole('button', { name: 'Propina' })).toHaveCount(0)
  })

  test('porcentajes de propina: agregar y quitar se ven SIN recargar, mandan la lista completa y con 6 ya no deja agregar', async ({
    page,
  }) => {
    const estado = await preparar(page)
    await abrirDetalle(page)
    const pasos = pasosDelCobro(page)
    const entrada = pasos.getByLabel('Agregar un porcentaje de propina')
    const agregar = async (porcentaje: string) => {
      await entrada.fill(porcentaje)
      await pasos.getByRole('button', { name: 'Agregar' }).click()
    }

    await agregar('18')
    await expect.poll(() => estado.cambiosDeAjustes).toEqual([{ tipSuggestions: [10, 15, 18, 20] }])
    // 🔴 La prueba es la lista, no el aviso:
    await expect(pasos.getByRole('button', { name: 'Quitar 18 %' })).toBeVisible()
    await expect(pasos.getByText('Máximo 6 porcentajes')).toHaveCount(0)

    await agregar('25')
    await expect(pasos.getByRole('button', { name: 'Quitar 25 %' })).toBeVisible()
    await agregar('30')
    await expect(pasos.getByRole('button', { name: 'Quitar 30 %' })).toBeVisible()
    expect(estado.ajustes.tipSuggestions).toEqual([10, 15, 18, 20, 25, 30])

    // El tope del POS (6): la lista llena no deja agregar y lo dice; el server nunca recibe un séptimo.
    await expect(pasos.getByText('Máximo 6 porcentajes. Quita uno para agregar otro.')).toBeVisible()
    await expect(entrada).toBeDisabled()
    await expect(pasos.getByRole('button', { name: 'Agregar' })).toBeDisabled()
    expect(estado.cambiosDeAjustes).toHaveLength(3)

    // Quitar uno libera el tope y se ve de inmediato.
    await pasos.getByRole('button', { name: 'Quitar 18 %' }).click()
    await expect(pasos.getByRole('button', { name: 'Quitar 18 %' })).toHaveCount(0)
    await expect(pasos.getByText('Máximo 6 porcentajes')).toHaveCount(0)
    await expect(entrada).toBeEnabled()
    expect(estado.cambiosDeAjustes.at(-1)).toEqual({ tipSuggestions: [10, 15, 20, 25, 30] })
  })

  test('un guardado de pasos que recibe un 5xx dice «Sin confirmar», relee y enseña lo que el servidor SÍ tiene', async ({ page }) => {
    const estado = await preparar(page, { pasos: '5xx', demoraDeLaRelecturaDePasos: 1_500 })
    await abrirDetalle(page)
    const pasos = pasosDelCobro(page)
    const estrellas = pasos.getByRole('switch', { name: 'Calificar con estrellas' })
    await expect(estrellas).toHaveAttribute('aria-checked', 'true')
    await estrellas.click()

    // Mientras relee: ni el valor de antes ni el supuesto; ningún interruptor lo afirma.
    await expect(pasos.getByText('Sin confirmar')).toHaveCount(3)
    await expect(pasos.getByRole('switch')).toHaveCount(0)
    // `exact`: el aviso sale dos veces (el toast y su copia para lectores de pantalla, que lleva «Notification» delante).
    await expect(page.getByText('No sabemos si se guardó', { exact: true })).toBeVisible()

    // Al terminar de releer manda el SERVIDOR: el PUT nunca se aplicó, así que «Calificar con estrellas» sigue prendido.
    await expect(pasos.getByText('Sin confirmar')).toHaveCount(0)
    await expect(estrellas).toHaveAttribute('aria-checked', 'true')
    await expect(estrellas).toBeEnabled()
    expect(estado.intentosDeAjustes).toBe(1) // un 5xx no se reenvía solo (sólo un error de RED se reintenta, en src/api.ts)
  })

  for (const status of [409, 429] as const) {
    test(`RED: la escritura de un paso se aplica, su respuesta se pierde y el reintento automático recibe ${status} ⇒ relee, enseña lo aplicado y NUNCA hay un tercer envío`, async ({
      page,
    }) => {
      const estado = await preparar(page, { pasos: 'aplicado-sin-red', respuestaDelReintento: status, demoraDeLaRelecturaDePasos: 1_500 })
      await abrirDetalle(page)
      const pasos = pasosDelCobro(page)
      const estrellas = pasos.getByRole('switch', { name: es.steps.review })
      await expect(estrellas).toHaveAttribute('aria-checked', 'true')
      await estrellas.click()

      // El primer PUT se aplicó y su respuesta se abortó; `src/api.ts` lo repitió solo una vez (1 s después) y recibió el 409 o
      // el 429. Ése NO prueba que «no se guardó» (lo provocó nuestra propia primera escritura): es INCIERTO.
      await expect.poll(() => estado.intentosDeAjustes).toBe(2)
      await expect(page.getByText(es.steps.uncertainTitle, { exact: true })).toBeVisible()
      await expect(pasos.getByText(es.steps.unconfirmed)).toHaveCount(3)
      await expect(pasos.getByRole('switch')).toHaveCount(0)
      await expect(page.getByText(es.steps.saveError, { exact: true })).toHaveCount(0)

      // Al releer manda el SERVIDOR: el cambio SÍ quedó (apagado), y no se volvió al valor de antes.
      await expect(pasos.getByText(es.steps.unconfirmed)).toHaveCount(0)
      await expect(estrellas).toHaveAttribute('aria-checked', 'false')
      await expect(estrellas).toBeEnabled()

      // Ningún tercer envío: ni la mutación ni la relectura vuelven a escribir.
      await page.waitForTimeout(2_500)
      expect(estado.intentosDeAjustes).toBe(2)
      expect(estado.peticiones.filter(p => p === `PUT ${RUTA_DE_LOS_PASOS}`)).toHaveLength(2)
      expect(estado.cambiosDeAjustes).toEqual([{ showReviewScreen: false }, { showReviewScreen: false }])
    })
  }

  test('si tras un guardado incierto la relectura de los pasos también falla, el error sale pronto (un reintento, no tres) y se puede reintentar', async ({
    page,
  }) => {
    await preparar(page, { pasos: '5xx-y-no-relee' })
    await abrirDetalle(page)
    const pasos = pasosDelCobro(page)
    await pasos.getByRole('switch', { name: 'Ofrecer recibo' }).click()
    // Con 3 reintentos tardaría ~7 s (> 5 s de espera de la aserción); con `retry: 1`, ~1 s.
    await expect(pasos.getByText('No pudimos cargar los pasos del cobro.')).toBeVisible()
    await expect(pasos.getByRole('switch')).toHaveCount(0)
    await expect(pasos.getByRole('button', { name: 'Reintentar' })).toBeVisible()
  })

  test('copiar: total sin el origen, «Cargar más» (bloqueado mientras carga) y, al reabrir, los destinos ya tienen diseño propio', async ({
    page,
  }) => {
    const estado = await preparar(page, { diseno: PROPIO, editToken: 'cdd-1:2', demoraDeLaSegundaPagina: 700 })
    await abrirDetalle(page)
    const tarjeta = page.getByTestId('customer-display-card')
    await tarjeta.getByRole('button', { name: 'Copiar a otras cajas' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Copiar a otras cajas' })
    await expect(dialogo.getByText('Mostrando 1 de 3')).toBeVisible()
    await expect(dialogo.getByRole('checkbox', { name: 'Caja 1' })).toHaveCount(0)
    await dialogo.getByRole('button', { name: 'Cargar más' }).click()
    // Mientras la segunda página viaja, el botón dice «Cargando…» y no se puede volver a pulsar.
    await expect(dialogo.getByRole('button', { name: 'Cargando…' })).toBeDisabled()
    await expect(dialogo.getByText('Mostrando 3 de 3')).toBeVisible()
    await dialogo.getByRole('checkbox', { name: 'Barra' }).click()
    await dialogo.getByRole('checkbox', { name: 'Caja 2' }).click()
    await dialogo.getByRole('button', { name: 'Copiar a 2 cajas' }).click()
    const confirmar = page.getByRole('alertdialog')
    await expect(confirmar).toContainText('Barra y Caja 2')
    await confirmar.getByRole('button', { name: 'Copiar', exact: true }).click()
    await expect
      .poll(() => estado.copias)
      .toEqual([
        {
          source: { terminalId: CAJA_1, editToken: 'cdd-1:2' },
          targets: [
            { terminalId: 'dev-barra', editToken: 'factory' },
            { terminalId: 'dev-caja-2', editToken: 'factory' },
          ],
        },
      ])
    await expect(page.getByText('Copiado a Barra y Caja 2. Cada una lo mostrará en cuanto se conecte.', { exact: true })).toBeVisible()
    await expect(dialogo).toBeHidden()
    // 🔴 La prueba: al reabrir, la lista ya dice que Barra tiene su propio diseño.
    await tarjeta.getByRole('button', { name: 'Copiar a otras cajas' }).click()
    const otraVez = page.getByRole('dialog', { name: 'Copiar a otras cajas' })
    await expect(otraVez.locator('[data-tour="customer-display-copy-row"]', { hasText: 'Barra' })).toContainText(
      'Tiene su propio diseño; se reemplaza',
    )
  })

  test('volver al diseño de fábrica: confirma, manda el token leído y la tarjeta dice «Diseño de fábrica» SIN recargar', async ({
    page,
  }) => {
    const estado = await preparar(page, { diseno: PROPIO, editToken: 'cdd-1:2' })
    await abrirDetalle(page)
    const tarjeta = page.getByTestId('customer-display-card')
    await expect(tarjeta).toContainText('Diseño propio')
    const editor = await abrirEditor(page)
    await editor.getByRole('button', { name: 'Volver al diseño de fábrica' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Sí, volver al de fábrica' }).click()
    await expect.poll(() => estado.restablecimientos).toEqual(['cdd-1:2'])
    await expect(editor.getByLabel('Al llegar')).toHaveValue('')
    await page.getByTestId('customer-display-editor-close').click()
    await expect(editor).toBeHidden()
    // 🔴 La prueba es la tarjeta, no el aviso:
    await expect(tarjeta).toContainText('Diseño de fábrica')
  })
})

test.describe('Pantalla del cliente — foco, conflicto y salida', () => {
  test('teclear un texto conserva el foco mientras la vista previa va y viene del servidor', async ({ page }) => {
    // 1.5 s: «Actualizando…» dura lo bastante para muestrearlo aunque la Mac vaya cargada.
    await preparar(page, { demoraDeVistaPrevia: 1_500 })
    await abrirDetalle(page)
    const editor = await abrirEditor(page)
    const campo = editor.getByLabel('Al llegar')
    await campo.click()
    await campo.pressSequentially('Hola de nuevo', { delay: 120 })
    // La pausa de 300 ms manda la vista previa al servidor (que tarda 400 ms en contestar): con la solicitud EN CAMINO el
    // campo sigue siendo el que tiene el foco. Es el momento en que un componente que se desmonta al cargar lo perdería.
    await expect(editor.getByText('Actualizando…')).toBeVisible()
    await expect(campo).toBeFocused()
    // Codex: las teclas van cada 120 ms y el debounce es de 300 ms (más 400 ms del server): se espera la vista previa del
    // texto FINAL y entonces se mira el foco; antes, la prueba podía mirar sin que la última respuesta hubiera pintado.
    await expect(editor.getByTestId('tablet-preview')).toContainText('Hola de nuevo')
    await expect(editor.getByText('Actualizando…')).toHaveCount(0)
    await expect(campo).toBeFocused()
    await expect(campo).toHaveValue('Hola de nuevo')
  })

  test('si alguien más guardó: el mensaje del servidor, «Guardar» bloqueado y «Recargar lo guardado» trae lo nuevo', async ({ page }) => {
    const estado = await preparar(page, { guardados: ['conflicto'] })
    await abrirDetalle(page)
    const editor = await abrirEditor(page)
    await editor.getByLabel('Al llegar').fill('Mi texto')
    await editor.getByRole('button', { name: 'Guardar' }).click()
    await expect(editor.getByText('Alguien más guardó este diseño mientras lo editabas.')).toBeVisible()
    await expect(editor.getByRole('button', { name: 'Guardar' })).toBeDisabled()
    expect(estado.guardados).toHaveLength(1)
    await editor.getByRole('button', { name: 'Recargar lo guardado' }).click()
    await expect(editor.getByLabel('Al llegar')).toHaveValue('Texto de otra persona')
    await expect(editor.getByText('Alguien más guardó este diseño mientras lo editabas.')).toHaveCount(0)
    await expect(editor.getByRole('button', { name: 'Guardar' })).toBeDisabled()
  })

  test('si la respuesta del guardado se pierde y el servidor NO lo tiene: «No pudimos confirmar», el borrador sigue y el reintento usa el MISMO token', async ({
    page,
  }) => {
    const estado = await preparar(page, { guardados: ['perdido'] })
    await abrirDetalle(page)
    const tarjeta = page.getByTestId('customer-display-card')
    const editor = await abrirEditor(page)
    await editor.getByLabel('Al llegar').fill('Mi texto')
    await editor.getByRole('button', { name: 'Guardar' }).click()
    await expect(editor.getByText('No pudimos confirmar si se guardó. Revisa lo guardado y vuelve a intentar.')).toBeVisible()
    // Se releyó el servidor y nada se afirmó: ni «Guardado», ni el diseño propio en la tarjeta; el borrador no se perdió.
    await expect(editor.getByRole('button', { name: 'Recargar lo guardado' })).toBeVisible()
    await expect(editor.getByLabel('Al llegar')).toHaveValue('Mi texto')
    await expect(tarjeta).toContainText('Diseño de fábrica')
    await expect(editor.getByRole('button', { name: 'Guardar' })).toBeEnabled()
    expect(estado.guardados).toHaveLength(1) // nunca se reenvía solo

    // Reintentar manda el mismo borrador con el token que se LEYÓ (el CAS protege), y esta vez sí queda.
    await editor.getByRole('button', { name: 'Guardar' }).click()
    await expect(editor).toBeHidden()
    expect(estado.guardados).toHaveLength(2)
    expect(estado.guardados[1].expectedEditToken).toBe('factory')
    expect(estado.guardados[1].design.welcomeText).toBe('Mi texto')
    await expect(tarjeta).toContainText('Diseño propio')
  })

  test('si la respuesta se pierde pero el servidor SÍ guardó: se da por guardado (la tarjeta cambia) y NO se reenvía', async ({ page }) => {
    const estado = await preparar(page, { guardados: ['aplicado-sin-respuesta'] })
    await abrirDetalle(page)
    const tarjeta = page.getByTestId('customer-display-card')
    const editor = await abrirEditor(page)
    await editor.getByLabel('Al llegar').fill('Mi texto')
    await editor.getByRole('button', { name: 'Guardar' }).click()
    await expect(editor).toBeHidden()
    await expect(tarjeta).toContainText('Diseño propio')
    await expect(tarjeta.getByTestId('tablet-preview')).toContainText('Mi texto')
    expect(estado.guardados).toHaveLength(1)
  })

  test('cerrar con cambios pregunta; «Seguir editando» no pierde nada y «Salir sin guardar» no manda nada', async ({ page }) => {
    const estado = await preparar(page)
    await abrirDetalle(page)
    const editor = await abrirEditor(page)
    await editor.getByLabel('Al terminar de pagar').fill('¡Vuelve pronto!')
    // Lo que se escribe se ve en SU momento: el texto de despedida, en «Gracias».
    await expect(editor.getByTestId('tablet-preview')).toHaveAttribute('data-momento', 'gracias')
    await expect(editor.getByTestId('tablet-preview')).toContainText('¡Vuelve pronto!')
    await page.getByTestId('customer-display-editor-close').click()
    const aviso = page.getByRole('alertdialog')
    await expect(aviso).toContainText('Tienes cambios sin guardar')
    await aviso.getByRole('button', { name: 'Seguir editando' }).click()
    await expect(editor.getByLabel('Al terminar de pagar')).toHaveValue('¡Vuelve pronto!')
    await page.getByTestId('customer-display-editor-close').click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Salir sin guardar' }).click()
    await expect(editor).toBeHidden()
    expect(estado.guardados).toHaveLength(0)
  })

  test('🔴 si una reconsulta de fondo falla con el editor abierto, el borrador sigue y la tarjeta lo avisa (Codex #3)', async ({
    page,
  }) => {
    await page.clock.install()
    const estado = await preparar(page)
    await abrirDetalle(page)
    const editor = await abrirEditor(page)
    await editor.getByLabel('Al llegar').fill('Borrador que no se pierde')
    const llamadasAntes = estado.llamadasALaVista
    estado.fallasDeLaVista = 99
    // La tarjeta vuelve a preguntar cada 30 s mientras la pantalla no confirma (y la consulta reintenta una vez a 1 s).
    await page.clock.fastForward(31_000)
    await expect.poll(() => estado.llamadasALaVista).toBeGreaterThan(llamadasAntes)
    await page.clock.fastForward(2_000)
    await expect.poll(() => estado.llamadasALaVista).toBeGreaterThan(llamadasAntes + 1)
    await expect(editor).toBeVisible()
    await expect(editor.getByLabel('Al llegar')).toHaveValue('Borrador que no se pierde')
    await page.getByTestId('customer-display-editor-close').click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Salir sin guardar' }).click()
    await expect(page.getByTestId('customer-display-card')).toContainText(
      'No pudimos actualizar el estado; se muestra lo último que sabemos.',
    )
  })
})

const AVISO_DE_LA_PAGINA = 'No pudimos actualizar los datos de este dispositivo; se muestran los últimos.'

test.describe('Pantalla del cliente — error de fondo de la PÁGINA del aparato', () => {
  test('🔴 si la reconsulta del aparato falla con el editor abierto, el editor y su borrador siguen; al cerrarlo, la página avisa (Codex F1 #1)', async ({
    page,
  }) => {
    // Todas las relecturas fallan: la consulta de la página agota sus 3 reintentos (1 s + 2 s + 4 s) y queda en error CON datos.
    const estado = await preparar(page, { fallasDelAparato: 99 })
    await abrirDetalle(page)
    const editor = await abrirEditor(page)
    await editor.getByLabel('Al llegar').fill('Borrador que no se pierde')
    // Volver a la pestaña (el foco) hace que TanStack reconsulte el detalle del aparato, como un `tpv_status_update` del socket.
    await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')))
    // La consulta de la página queda en error CON datos: el aviso aparece (debajo del editor, que ocupa la pantalla)…
    // Antes del arreglo, en este punto la página entera cambiaba a «Error al cargar el terminal» y el editor desaparecía.
    await expect(page.getByText(AVISO_DE_LA_PAGINA)).toBeAttached({ timeout: 15_000 })
    expect(estado.llamadasAlAparato).toBe(1 + 1 + 3)
    // …y el editor y su borrador siguen.
    await expect(editor).toBeVisible()
    await expect(editor.getByLabel('Al llegar')).toHaveValue('Borrador que no se pierde')
    await page.getByTestId('customer-display-editor-close').click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Salir sin guardar' }).click()
    await expect(page.getByText(AVISO_DE_LA_PAGINA)).toBeVisible()
    await expect(page.getByTestId('customer-display-card')).toBeVisible()
    await expect(page.getByText('Error al cargar el terminal')).toHaveCount(0)
  })
})

test.describe('Pantalla del cliente — estados que no son el camino feliz', () => {
  test('sin permiso de ver: se explica y NO se consulta NADA de la pantalla del cliente', async ({ page }) => {
    const estado = await preparar(page, { permisos: ['tpv-settings:read'] })
    await abrirDetalle(page, false)
    await expect(page.getByText(es.card.noReadPermission)).toBeVisible({ timeout: 15_000 })
    // Los pasos (otro permiso) sí cargaron: ya pasó el momento en que la tarjeta habría pedido el diseño si fuera a pedirlo.
    await expect(pasosDelCobro(page).getByRole('switch', { name: 'Pedir propina' })).toBeVisible()
    expect(estado.llamadasALaVista).toBe(0)
    // Ni la lectura, ni la vista previa, ni la lista de destinos: ninguna petición a /customer-display.
    expect(estado.peticiones.filter(p => p.includes('/customer-display'))).toEqual([])
    expect(estado.inesperadas).toEqual([])
  })

  test('sólo lectura: se ve el estado, sin botones de editar ni copiar, los pasos no se mueven y no se manda ninguna escritura', async ({
    page,
  }) => {
    const estado = await preparar(page, { permisos: ['customer-display:read', 'tpv-settings:read'] })
    await abrirDetalle(page)
    const tarjeta = page.getByTestId('customer-display-card')
    await expect(tarjeta).toContainText(es.card.designFactory)
    await expect(tarjeta).toContainText(es.card.readOnly)
    await expect(tarjeta.getByRole('button', { name: 'Editar pantalla' })).toHaveCount(0)
    await expect(tarjeta.getByRole('button', { name: 'Copiar a otras cajas' })).toHaveCount(0)
    await expect(page.getByRole('switch', { name: 'Pedir propina' })).toBeDisabled()
    // Sin poder cambiarlos, tampoco se ofrece agregar ni quitar porcentajes.
    await expect(pasosDelCobro(page).getByLabel('Agregar un porcentaje de propina')).toHaveCount(0)
    await expect(pasosDelCobro(page).getByRole('button', { name: /^Quitar/ })).toHaveCount(0)
    // Sólo se lee: ni un POST, ni un PUT, ni un DELETE en toda la sesión.
    expect(estado.peticiones.filter(p => !p.startsWith('GET '))).toEqual([])
    expect(estado.inesperadas).toEqual([])
  })

  test('mientras la tarjeta CARGA no se ve «de fábrica» ni error; al llegar la respuesta aparece', async ({ page }) => {
    const estado = await preparar(page, { demoraDeLaVista: 4_000 })
    await abrirDetalle(page, false)
    const seccion = page.locator('[data-tour="customer-display-section"]')
    // La sección ya está (el detalle del dispositivo cargó) y la lectura del diseño sigue EN CAMINO: no es «vacío», es «cargando».
    await expect(seccion).toBeVisible({ timeout: 15_000 })
    await expect.poll(() => estado.llamadasALaVista).toBe(1)
    await expect(seccion.getByTestId('customer-display-card')).toHaveCount(0)
    await expect(seccion.getByText(es.card.designFactory)).toHaveCount(0)
    await expect(seccion.getByText(es.card.designOwn)).toHaveCount(0)
    await expect(seccion.getByRole('alert')).toHaveCount(0)
    await expect(seccion.getByText(es.card.loadError)).toHaveCount(0)
    await expect(seccion.getByRole('button', { name: 'Editar pantalla' })).toHaveCount(0)
    // Al llegar: la tarjeta con su estado real, y nunca pasó por el error.
    await expect(seccion.getByTestId('customer-display-card')).toContainText(es.card.designFactory, { timeout: 10_000 })
    await expect(seccion.getByRole('alert')).toHaveCount(0)
  })

  test('si el servidor falla al cargar, se dice y se puede reintentar (no se ve como «de fábrica»)', async ({ page }) => {
    // La consulta reintenta una vez: dos fallas = error visible.
    await preparar(page, { fallasDeLaVista: 2 })
    await abrirDetalle(page, false)
    const error = page.getByRole('alert').filter({ hasText: 'No pudimos cargar la pantalla del cliente.' })
    await expect(error).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('customer-display-card')).toHaveCount(0)
    await expect(page.getByText('Diseño de fábrica')).toHaveCount(0)
    await error.getByRole('button', { name: 'Reintentar' }).click()
    await expect(page.getByTestId('customer-display-card')).toContainText('Diseño de fábrica')
    await expect(error).toHaveCount(0)
  })

  test('copiar un diseño de fábrica se explica en vez de abrir la lista', async ({ page }) => {
    await preparar(page)
    await abrirDetalle(page)
    await page.getByTestId('customer-display-card').getByRole('button', { name: 'Copiar a otras cajas' }).click()
    await expect(page.getByText('Primero personaliza y guarda esta caja; después la copias a las demás.', { exact: true })).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Copiar a otras cajas' })).toHaveCount(0)
  })

  test('copiar: lista vacía (sin otras cajas) se ve distinto de un error', async ({ page }) => {
    await preparar(page, { diseno: PROPIO, editToken: 'cdd-1:2', destinos: 'vacia' })
    await abrirDetalle(page)
    await page.getByTestId('customer-display-card').getByRole('button', { name: 'Copiar a otras cajas' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Copiar a otras cajas' })
    await expect(dialogo.getByText('No hay otras cajas con pantalla del cliente en esta sucursal.')).toBeVisible()
    await expect(dialogo.getByText('No pudimos cargar la lista de cajas.')).toHaveCount(0)
    await expect(dialogo.getByRole('button', { name: 'Reintentar' })).toHaveCount(0)
  })

  test('copiar: si la lista falla, se dice y hay «Reintentar»', async ({ page }) => {
    await preparar(page, { diseno: PROPIO, editToken: 'cdd-1:2', destinos: 'error' })
    await abrirDetalle(page)
    await page.getByTestId('customer-display-card').getByRole('button', { name: 'Copiar a otras cajas' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Copiar a otras cajas' })
    await expect(dialogo.getByText('No pudimos cargar la lista de cajas.')).toBeVisible({ timeout: 10_000 })
    await expect(dialogo.getByText('No hay otras cajas con pantalla del cliente en esta sucursal.')).toHaveCount(0)
    await expect(dialogo.getByRole('button', { name: 'Reintentar' })).toBeVisible()
  })

  test('copiar: mientras la lista CARGA no se ve «vacía» ni error; al llegar la respuesta aparece el vacío', async ({ page }) => {
    const estado = await preparar(page, { diseno: PROPIO, editToken: 'cdd-1:2', destinos: 'vacia', demoraDeDestinos: 4_000 })
    await abrirDetalle(page)
    await page.getByTestId('customer-display-card').getByRole('button', { name: 'Copiar a otras cajas' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Copiar a otras cajas' })
    const lista = dialogo.locator('[data-tour="customer-display-copy-list"]')
    // El diálogo y su lista ya están y la primera página sigue EN CAMINO: ni el vacío ni el error ni filas ni contador.
    await expect(lista).toBeVisible()
    await expect.poll(() => estado.llamadasADestinos).toBe(1)
    await expect(dialogo.getByText(es.copy.empty)).toHaveCount(0)
    await expect(dialogo.getByText(es.copy.loadError)).toHaveCount(0)
    await expect(dialogo.getByRole('button', { name: es.copy.retry })).toHaveCount(0)
    await expect(dialogo.getByRole('checkbox')).toHaveCount(0)
    await expect(dialogo.getByText(/^Mostrando /)).toHaveCount(0)
    // Con la respuesta, el vacío (una sola otra caja: ninguna a la que copiar); el error nunca salió.
    await expect(dialogo.getByText(es.copy.empty)).toBeVisible({ timeout: 10_000 })
    await expect(dialogo.getByText(es.copy.loadError)).toHaveCount(0)
  })

  test('modo oscuro del editor (captura para revisión)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await preparar(page, { diseno: PROPIO, editToken: 'cdd-1:2' })
    await abrirDetalle(page)
    // El tema de la app sigue al sistema: sin esto la «captura en oscuro» saldría en claro sin que nadie lo notara.
    await expect(page.locator('html')).toHaveClass(/dark/)
    if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/pantalla-cliente-tarjeta-oscuro.png`, fullPage: true })
    const editor = await abrirEditor(page)
    await expect(editor.getByTestId('tablet-preview')).toBeVisible()
    if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/pantalla-cliente-editor-oscuro.png`, fullPage: true })
  })
})
